const IngestedContent = require('../models/IngestedContent');
const ChatHistory = require('../models/ChatHistory');
const { GoogleGenAI } = require('@google/genai');

/**
 * Query chatbot with selected ingested sources
 */
const queryChatbot = async (req, res) => {
  try {
    const { prompt, source_ids, session_code } = req.body;
    
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }
    
    if (!session_code) {
      return res.status(400).json({
        success: false,
        message: 'Session code is required'
      });
    }
    
    if (!source_ids || !Array.isArray(source_ids) || source_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one source must be selected'
      });
    }
    
    // Fetch ingested content for selected sources
    const ingestedSources = await IngestedContent.find({
      _id: { $in: source_ids },
      session_code: session_code,
      status: 'completed' // Only use successfully ingested content
    }).lean();
    
    if (ingestedSources.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No valid ingested sources found for the selected IDs'
      });
    }
    
    // Build context from ingested sources
    const contextParts = [];
    const sourceMap = new Map(); // Track which content came from which source
    
    ingestedSources.forEach((source, index) => {
      const sourceInfo = {
        id: source._id.toString(),
        type: source.source_type,
        title: source.title || source.page_title || 'Untitled',
        url: source.url || null,
        domain: source.domain || null
      };
      
      let contentLabel = '';
      if (source.source_type === 'page') {
        contentLabel = `Page: ${sourceInfo.title}`;
      } else {
        contentLabel = `Website: ${sourceInfo.title}${sourceInfo.url ? ` (${sourceInfo.url})` : ''}`;
      }
      
      contextParts.push(`[Source ${index + 1}: ${contentLabel}]\n${source.content || ''}`);
      sourceMap.set(index + 1, sourceInfo);
    });
    
    const context = contextParts.join('\n\n---\n\n');
    
    // Build prompt for Gemini
    const fullPrompt = `You are a helpful AI assistant that answers questions based ONLY on the following ingested content from a collaborative research session.

CRITICAL RULES:
1. Answer ONLY what is asked in the question. Do not provide additional information beyond what is requested.
2. If the question cannot be answered using the provided ingested content, you MUST state that the information is not available in the ingested sources.
3. Do not make assumptions or provide information that is not explicitly present in the ingested content.
4. When referencing specific information, indicate which source it came from using the format [Source X] where X is the source number.

INGESTED CONTENT:
${context}

USER QUESTION:
${prompt}

IMPORTANT: 
- If the question asks about something that is NOT present in the ingested content above, respond with: "The information requested is not available in the selected ingested sources. Please try rephrasing your question or select different sources."
- Only use information that is explicitly stated in the ingested content.
- Be concise and direct - answer only what is asked.

Format your response as JSON with the following structure:
{
  "answer": "Your direct answer to the user's question, with source citations in the format [Source X]. If information is not available, state that clearly.",
  "sources": [
    {
      "source_number": 1,
      "type": "page" or "website",
      "title": "Source title",
      "url": "URL if website",
      "relevance": "Brief explanation of how this source was relevant to the answer"
    }
  ]
}

Return ONLY valid JSON, no additional text or markdown.`;
    
    // Initialize Gemini AI
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Gemini API key not configured'
      });
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
    });
    
    const responseText = response.text || 'Unable to generate response.';
    
    // Parse JSON response
    let responseData;
    try {
      // Extract JSON from response (might have markdown code blocks)
      let jsonText = responseText.trim();
      
      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      // Find JSON object
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
      
      // Try to parse
      responseData = JSON.parse(jsonText);
      
      // Map source numbers to actual source info
      if (responseData.sources) {
        // Ensure it's an array
        if (!Array.isArray(responseData.sources)) {
          console.warn('responseData.sources is not an array after JSON.parse:', typeof responseData.sources);
          // Try to parse if it's a string
          if (typeof responseData.sources === 'string') {
            try {
              // Try JSON.parse first
              const parsed = JSON.parse(responseData.sources);
              if (Array.isArray(parsed)) {
                responseData.sources = parsed;
              } else {
                console.error('Parsed sources is not an array:', typeof parsed);
                responseData.sources = [];
              }
            } catch (e) {
              console.error('Failed to parse sources string as JSON:', e);
              responseData.sources = [];
            }
          } else {
            console.error('responseData.sources is neither array nor string:', typeof responseData.sources);
            responseData.sources = [];
          }
        }
        
        // Now ensure it's still an array before mapping
        if (Array.isArray(responseData.sources)) {
          responseData.sources = responseData.sources
            .filter(src => src && typeof src === 'object')
            .map(src => {
              const sourceInfo = sourceMap.get(src.source_number);
              return {
                source_number: typeof src.source_number === 'number' ? src.source_number : 0,
                type: typeof src.type === 'string' ? src.type : (sourceInfo?.source_type || 'website'),
                title: typeof src.title === 'string' ? src.title : (sourceInfo?.title || 'Untitled'),
                url: typeof src.url === 'string' ? src.url : (sourceInfo?.url || null),
                relevance: typeof src.relevance === 'string' ? src.relevance : ''
              };
            });
        } else {
          console.error('responseData.sources is not an array after processing:', typeof responseData.sources);
          responseData.sources = [];
        }
      } else {
        responseData.sources = [];
      }
      
      // Final check before proceeding
      if (!Array.isArray(responseData.sources)) {
        console.error('responseData.sources is not an array at end of parsing:', typeof responseData.sources);
        responseData.sources = [];
      }
    } catch (parseError) {
      console.error('Error parsing chatbot response:', parseError);
      // Fallback: return raw response
      responseData = {
        answer: responseText,
        sources: ingestedSources.map((source, idx) => ({
          source_number: idx + 1,
          type: source.source_type,
          title: source.title || source.page_title || 'Untitled',
          url: source.url || null,
          relevance: 'Used in response'
        }))
      };
    }
    
    // Save to chat history
    try {
      const userCode = req.user?.user_code || req.body.user_code || 'unknown';
      
      // Ensure sources is an array - start fresh
      let sourcesArray = [];
      
      // Debug: log what we're getting
      console.log('responseData.sources type:', typeof responseData.sources);
      console.log('responseData.sources isArray:', Array.isArray(responseData.sources));
      if (responseData.sources) {
        console.log('responseData.sources value (first 200 chars):', String(responseData.sources).substring(0, 200));
      }
      
      if (responseData.sources) {
        if (Array.isArray(responseData.sources)) {
          sourcesArray = [...responseData.sources]; // Create a copy
        } else if (typeof responseData.sources === 'string') {
          // Try to parse if it's a string
          try {
            const parsed = JSON.parse(responseData.sources);
            if (Array.isArray(parsed)) {
              sourcesArray = parsed;
            } else {
              console.warn('Parsed sources is not an array:', typeof parsed);
              sourcesArray = [];
            }
          } catch (e) {
            console.error('Error parsing sources string:', e);
            sourcesArray = [];
          }
        } else {
          console.warn('responseData.sources is neither array nor string:', typeof responseData.sources);
          sourcesArray = [];
        }
      }
      
      // Ensure each source has the required fields and only schema fields
      sourcesArray = sourcesArray
        .filter(src => src !== null && typeof src === 'object')
        .map(src => {
          // Only include fields that are in the schema
          return {
            source_number: typeof src.source_number === 'number' ? src.source_number : 0,
            type: typeof src.type === 'string' ? src.type : 'website',
            title: typeof src.title === 'string' ? src.title : 'Untitled',
            url: typeof src.url === 'string' ? src.url : null,
            relevance: typeof src.relevance === 'string' ? src.relevance : ''
          };
        });
      
      // Final validation
      if (!Array.isArray(sourcesArray)) {
        console.error('sourcesArray is not an array after processing:', typeof sourcesArray);
        sourcesArray = [];
      }
      
      console.log('Final sourcesArray length:', sourcesArray.length);
      console.log('Final sourcesArray isArray:', Array.isArray(sourcesArray));
      
      // Ensure source_ids are valid ObjectIds
      const validSourceIds = source_ids
        .map(id => {
          try {
            // If it's already an ObjectId string, return it
            if (typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/)) {
              return id;
            }
            return null;
          } catch (e) {
            return null;
          }
        })
        .filter(id => id !== null);
      
      // Final safety check - ensure sourcesArray is definitely an array
      if (!Array.isArray(sourcesArray)) {
        console.error('CRITICAL: sourcesArray is not an array before creating responseObj:', typeof sourcesArray, sourcesArray);
        sourcesArray = [];
      }
      
      // Create clean array of source objects - ensure each is a plain object
      const cleanSourcesArray = sourcesArray.map(src => {
        // Create a plain object with only the fields we need
        const cleanSrc = {
          source_number: typeof src.source_number === 'number' ? src.source_number : 0,
          type: typeof src.type === 'string' ? src.type : 'website',
          title: typeof src.title === 'string' ? src.title : 'Untitled',
          url: typeof src.url === 'string' ? src.url : null,
          relevance: typeof src.relevance === 'string' ? src.relevance : ''
        };
        return cleanSrc;
      });
      
      // Final validation - ensure it's an array
      if (!Array.isArray(cleanSourcesArray)) {
        console.error('CRITICAL: cleanSourcesArray is not an array:', typeof cleanSourcesArray);
        cleanSourcesArray = [];
      }
      
      // Log the actual structure
      console.log('About to save chat history with sources type:', typeof cleanSourcesArray);
      console.log('About to save chat history with sources isArray:', Array.isArray(cleanSourcesArray));
      console.log('About to save chat history with sources length:', cleanSourcesArray.length);
      if (cleanSourcesArray.length > 0) {
        console.log('First source item:', cleanSourcesArray[0]);
        console.log('First source item type:', typeof cleanSourcesArray[0]);
        console.log('First source item isObject:', typeof cleanSourcesArray[0] === 'object' && cleanSourcesArray[0] !== null && !Array.isArray(cleanSourcesArray[0]));
      }
      
      // Create response object - ensure sources is definitely an array
      const responseObj = {
        answer: typeof responseData.answer === 'string' ? responseData.answer : String(responseData.answer || ''),
        sources: Array.isArray(cleanSourcesArray) ? cleanSourcesArray : []
      };
      
      // Log the response object structure
      console.log('responseObj.sources type:', typeof responseObj.sources);
      console.log('responseObj.sources isArray:', Array.isArray(responseObj.sources));
      
      // Create the document
      const chatHistory = new ChatHistory({
        session_code: session_code,
        user_code: userCode,
        prompt: prompt,
        response: {
          answer: responseObj.answer,
          sources: responseObj.sources
        },
        source_ids: validSourceIds
      });
      
      // Check what Mongoose sees before save
      console.log('Before save - chatHistory.response.sources type:', typeof chatHistory.response.sources);
      console.log('Before save - chatHistory.response.sources isArray:', Array.isArray(chatHistory.response.sources));
      if (chatHistory.response.sources && chatHistory.response.sources.length > 0) {
        console.log('Before save - chatHistory first source type:', typeof chatHistory.response.sources[0]);
        console.log('Before save - chatHistory first source:', chatHistory.response.sources[0]);
      }
      
      // Try to save
      try {
        await chatHistory.save();
        console.log('Chat history saved successfully');
      } catch (saveError) {
        console.error('Save error details:');
        console.error('chatHistory.response:', chatHistory.response);
        console.error('chatHistory.response.sources:', chatHistory.response.sources);
        console.error('chatHistory.response.sources type:', typeof chatHistory.response.sources);
        if (chatHistory.response.sources && chatHistory.response.sources.length > 0) {
          console.error('First source in error:', chatHistory.response.sources[0]);
          console.error('First source type:', typeof chatHistory.response.sources[0]);
        }
        throw saveError;
      }
    } catch (historyError) {
      console.error('Error saving chat history:', historyError);
      // Don't fail the request if history save fails
    }
    
    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error querying chatbot:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to query chatbot',
      error: error.message
    });
  }
};

/**
 * Get chat history for a session
 */
const getChatHistory = async (req, res) => {
  try {
    const { session_code } = req.params;
    
    if (!session_code) {
      return res.status(400).json({
        success: false,
        message: 'Session code is required'
      });
    }
    
    const chatHistory = await ChatHistory.find({ session_code })
      .sort({ created_at: 1 }) // Oldest first
      .lean();
    
    res.json({
      success: true,
      data: chatHistory
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chat history',
      error: error.message
    });
  }
};

module.exports = {
  queryChatbot,
  getChatHistory
};

