const Session = require('../models/Session');
const NavigationTracking = require('../models/NavigationTracking');
const TeamSessionAnalysis = require('../models/TeamSessionAnalysis');
const { GoogleGenAI } = require('@google/genai');

/**
 * Get all unique pages visited by all team members in a session
 */
async function getAllSessionPages(sessionCode) {
  try {
    // Get all navigation tracking data for this session (all members)
    const allTrackingData = await NavigationTracking.find({
      session_code: sessionCode
    })
      .select('navigation_events user_code recording_started_at')
      .sort({ recording_started_at: 1 })
      .lean();

    // Collect all unique pages
    const uniquePages = new Map(); // url -> { url, title, domain, visitedBy: Set }

    allTrackingData.forEach(tracking => {
      if (tracking.navigation_events && tracking.navigation_events.length > 0) {
        tracking.navigation_events.forEach(event => {
          // Only process PAGE_LOADED events
          if (event.event_type === 'PAGE_LOADED' || event.event_type === 'PAGE_OPEN') {
            const url = event.context?.url || event.context?.full_url || '';
            if (!url) return;

            const title = event.context?.title || '';
            let domain = event.context?.domain || '';
            if (!domain && url) {
              try {
                domain = new URL(url).hostname;
              } catch {
                domain = url;
              }
            }

            if (!uniquePages.has(url)) {
              uniquePages.set(url, {
                url,
                title,
                domain,
                visitedBy: new Set()
              });
            }
            // Add user who visited
            if (tracking.user_code) {
              uniquePages.get(url).visitedBy.add(tracking.user_code);
            }
          }
        });
      }
    });

    // Convert to array
    return Array.from(uniquePages.values()).map(page => ({
      ...page,
      visitedBy: Array.from(page.visitedBy)
    }));
  } catch (error) {
    console.error('Error getting session pages:', error);
    throw error;
  }
}

/**
 * Analyze team session and generate summary + relevance scores
 */
async function analyzeTeamSession(sessionCode) {
  let analysis = null; // Declare at function scope so it's accessible in catch block
  try {
    // Get session info
    const session = await Session.findOne({ session_code: sessionCode });
    if (!session) {
      throw new Error('Session not found');
    }

    const sessionDescription = session.session_description || 'No description provided';
    const sessionName = session.session_name || sessionCode;

    // Get all unique pages visited
    const allPages = await getAllSessionPages(sessionCode);
    if (allPages.length === 0) {
      console.log(`No pages found for session ${sessionCode}`);
      return null;
    }

    // Get or create analysis document
    analysis = await TeamSessionAnalysis.findOne({ session_code: sessionCode });
    if (!analysis) {
      const sitesArray = allPages.map(page => ({
        url: page.url,
        title: page.title,
        domain: page.domain
      }));
      analysis = await TeamSessionAnalysis.create({
        session_code: sessionCode,
        session: session._id,
        sites: sitesArray,
        total_sites: sitesArray.length,
        analyzed_sites: 0
      });
    } else {
      // Add any new pages that aren't in the analysis yet
      const existingUrls = new Set(analysis.sites.map(s => s.url));
      let addedCount = 0;
      allPages.forEach(page => {
        if (!existingUrls.has(page.url)) {
          analysis.sites.push({
            url: page.url,
            title: page.title,
            domain: page.domain
          });
          addedCount++;
        }
      });
      if (addedCount > 0) {
        analysis.total_sites = analysis.sites.length;
        await analysis.save();
      }
    }

    // Get sites without relevance scores
    const unanalyzedSites = analysis.getUnanalyzedSites();
    
    console.log(`Session ${sessionCode}: ${unanalyzedSites.length} unanalyzed sites out of ${analysis.sites.length} total`);
    
    if (unanalyzedSites.length === 0) {
      console.log(`All sites already analyzed for session ${sessionCode}`);
      // Still update counts to ensure they're correct
      analysis.total_sites = analysis.sites.length;
      analysis.analyzed_sites = analysis.sites.filter(s => s.relevance_score !== null && s.relevance_score !== undefined).length;
      await analysis.save();
      return analysis;
    }

    // Prepare sites data for LLM
    const sitesForAnalysis = unanalyzedSites.map(site => ({
      url: site.url,
      title: site.title || 'N/A',
      domain: site.domain || 'N/A'
    }));

    // Check if we have existing summaries
    const existingSummary = analysis.team_summary || '';
    const existingUnderstanding = analysis.team_understanding || '';

    // Prepare prompt for Gemini
    let prompt = `You are analyzing a collaborative research session for a team.

Session Topic/Description: "${sessionDescription}"
Session Name: "${sessionName}"

${existingSummary ? `Previous Team Summary:\n${existingSummary}\n\n` : ''}
${existingUnderstanding ? `Previous Team Understanding:\n${existingUnderstanding}\n\n` : ''}

The team has visited the following websites:
${sitesForAnalysis.map((site, idx) => `${idx + 1}. ${site.title} (${site.domain}) - ${site.url}`).join('\n')}

You need to generate TWO distinct pieces of information, both formatted as well-structured, easy-to-read paragraphs:

1. **team_summary**: A clear, concise summary of what sites the team has been browsing. Format this as 2-3 well-structured paragraphs that:
   - Describe the types of websites visited and domains explored
   - Highlight the general browsing patterns and themes
   - Group related sites together logically
   - Use proper paragraph breaks for readability
   ${existingSummary ? 'Update and expand the existing summary with new sites, maintaining paragraph structure.' : 'Create a new summary with clear paragraph formatting.'}

2. **team_understanding**: An analysis of how the team's browsing activity compares to the session description/topic and whether they are going in the right direction. Format this as 2-4 well-structured paragraphs that:
   - Evaluate how well the visited sites align with the session topic/description
   - Assess whether the team is on track with their research goals
   - Identify any gaps or areas that might need more attention
   - Provide overall progress assessment and relevance evaluation
   - Use proper paragraph breaks, clear topic sentences, and logical flow
   ${existingUnderstanding ? 'Update and expand the existing understanding based on new sites, maintaining paragraph structure.' : 'Create a new understanding with clear paragraph formatting.'}

IMPORTANT: Both team_summary and team_understanding must be formatted as readable paragraphs with proper line breaks. Use \\n\\n to separate paragraphs. Write in a clear, professional tone that is easy to understand.

3. **site_relevance**: Provide a relevance score (0-100) for each site indicating how relevant it is to the session topic/description.

Format your response as JSON with the following structure:
{
  "team_summary": "Summary of sites browsed and browsing patterns",
  "team_understanding": "Analysis of how browsing compares to session description and are they going in the right direction.",
  "site_relevance": [
    {
      "url": "exact_url_from_list",
      "relevance_score": <number 0-100>,
      "relevance_explanation": "Brief explanation of why this score was given"
    }
  ]
}

CRITICAL: Return ONLY valid, complete JSON. Do not include markdown code blocks, do not add any text before or after the JSON. The response must be valid JSON that can be parsed directly. Ensure all strings are properly escaped and all braces/brackets are closed.`;

    // Initialize Gemini AI
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error(`Gemini API key not configured for session ${sessionCode}`);
      throw new Error('Gemini API key not configured');
    }

    console.log(`Calling Gemini API for session ${sessionCode} with ${sitesForAnalysis.length} sites...`);
    
    // Declare analysisData outside try-catch so it's accessible later
    let analysisData;
    
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      let responseText = response.text || '';
      console.log(`Gemini API response received for session ${sessionCode}, length: ${responseText.length}`);
      
      // Clean up the response - remove markdown code blocks if present
      responseText = responseText.trim();
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      }
      responseText = responseText.trim();
      
      // Parse JSON response
      try {
        // Try to find JSON object - look for the first { and try to find matching }
        let jsonStart = responseText.indexOf('{');
        if (jsonStart === -1) {
          throw new Error('No JSON object found in response');
        }
        
        // Find the matching closing brace
        let braceCount = 0;
        let jsonEnd = -1;
        for (let i = jsonStart; i < responseText.length; i++) {
          if (responseText[i] === '{') braceCount++;
          if (responseText[i] === '}') braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
        
        if (jsonEnd === -1 || jsonEnd <= jsonStart) {
          // If we can't find matching brace, try regex as fallback
          console.warn(`Could not find matching closing brace for session ${sessionCode}, trying regex fallback`);
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              analysisData = JSON.parse(jsonMatch[0]);
            } catch (e) {
              // If regex match also fails, try to fix common JSON issues
              let fixedJson = jsonMatch[0];
              // Try to close unclosed strings/objects
              if (!fixedJson.endsWith('}')) {
                // Count open braces and close them
                const openBraces = (fixedJson.match(/\{/g) || []).length;
                const closeBraces = (fixedJson.match(/\}/g) || []).length;
                const missingBraces = openBraces - closeBraces;
                if (missingBraces > 0) {
                  // Try to close arrays first if any
                  const openArrays = (fixedJson.match(/\[/g) || []).length;
                  const closeArrays = (fixedJson.match(/\]/g) || []).length;
                  const missingArrays = openArrays - closeArrays;
                  fixedJson += ']'.repeat(missingArrays);
                  fixedJson += '}'.repeat(missingBraces);
                }
              }
              try {
                analysisData = JSON.parse(fixedJson);
                console.log(`Successfully parsed fixed JSON for session ${sessionCode}`);
              } catch (e2) {
                throw new Error('Could not extract valid JSON from response even after fixing');
              }
            }
          } else {
            throw new Error('Could not extract valid JSON from response');
          }
        } else {
          const jsonString = responseText.substring(jsonStart, jsonEnd);
          analysisData = JSON.parse(jsonString);
        }
        
        console.log(`Successfully parsed JSON for session ${sessionCode}`);
      } catch (parseError) {
        console.error(`Error parsing LLM response for session ${sessionCode}:`, parseError);
        console.error('Response text (first 1500 chars):', responseText.substring(0, 1500));
        console.error('Full response length:', responseText.length);
        throw new Error('Failed to parse LLM response');
      }
    } catch (apiError) {
      console.error(`Gemini API error for session ${sessionCode}:`, apiError);
      
      // Handle quota/rate limit errors gracefully
      if (apiError.status === 429 || (apiError.message && apiError.message.includes('429'))) {
        const retryDelay = 60; // Default 60 seconds
        console.log(`Quota exceeded for session ${sessionCode}. Will retry later.`);
        // Don't throw - return the analysis document so it can be retried later
        if (analysis) {
          // Update counts even on quota error
          analysis.total_sites = analysis.sites.length;
          analysis.analyzed_sites = analysis.sites.filter(s => s.relevance_score !== null && s.relevance_score !== undefined).length;
          await analysis.save();
        }
        return analysis;
      }
      
      throw apiError;
    }

    // Update analysis document
    if (analysisData) {
      // Update team_summary (summary of sites browsed)
      if (analysisData.team_summary) {
        analysis.team_summary = analysisData.team_summary;
      }
      
      // Update team_understanding (how browsing compares to session description)
      if (analysisData.team_understanding) {
        analysis.team_understanding = analysisData.team_understanding;
      }
    }

    // Update site relevance scores
    if (analysisData && analysisData.site_relevance && Array.isArray(analysisData.site_relevance)) {
      analysisData.site_relevance.forEach(siteData => {
        analysis.updateSiteRelevance(siteData.url, {
          relevance_score: siteData.relevance_score || null,
          relevance_explanation: siteData.relevance_explanation || ''
        });
      });
    }

    // Update counts after relevance updates
    analysis.total_sites = analysis.sites.length;
    analysis.analyzed_sites = analysis.sites.filter(s => s.relevance_score !== null && s.relevance_score !== undefined).length;
    analysis.last_analyzed_at = new Date();
    analysis.analysis_count = (analysis.analysis_count || 0) + 1;
    
    await analysis.save();
    
    console.log(`Analysis complete for session ${sessionCode}: ${analysis.analyzed_sites}/${analysis.total_sites} sites analyzed, summary length: ${analysis.team_summary?.length || 0}`);
    
    return analysis;
  } catch (error) {
    console.error(`Error analyzing team session ${sessionCode}:`, error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack?.substring(0, 500)
    });
    // Return the analysis document even if it failed, so it can be retried
    if (analysis) {
      // Update counts even on error
      analysis.total_sites = analysis.sites.length;
      analysis.analyzed_sites = analysis.sites.filter(s => s.relevance_score !== null && s.relevance_score !== undefined).length;
      await analysis.save();
    }
    throw error;
  }
}

/**
 * Process all active sessions
 */
async function processAllActiveSessions() {
  try {
    // Get all active sessions
    const activeSessions = await Session.find({ 
      is_active: true 
    }).select('session_code').lean();

    console.log(`Processing ${activeSessions.length} active sessions for team analysis...`);

    for (const session of activeSessions) {
      try {
        await analyzeTeamSession(session.session_code);
      } catch (error) {
        console.error(`Error processing session ${session.session_code}:`, error);
        // Continue with other sessions even if one fails
      }
    }
  } catch (error) {
    console.error('Error processing active sessions:', error);
  }
}

module.exports = {
  analyzeTeamSession,
  getAllSessionPages,
  processAllActiveSessions
};

