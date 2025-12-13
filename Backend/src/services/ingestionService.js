const axios = require('axios');
const cheerio = require('cheerio');
const IngestedContent = require('../models/IngestedContent');
const TeamPage = require('../models/TeamPage');
const PrivatePage = require('../models/PrivatePage');

/**
 * Scrape content from a website URL
 */
async function scrapeWebsite(url) {
  try {
    console.log(`Scraping website: ${url}`);
    
    // Fetch the webpage with increased timeout for large pages
    const response = await axios.get(url, {
      timeout: 60000, // 60 second timeout for large pages
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      maxRedirects: 10, // Allow more redirects
      maxContentLength: Infinity, // No content length limit
      maxBodyLength: Infinity // No body length limit
    });

    // Parse HTML with cheerio
    const $ = cheerio.load(response.data);
    
    // Remove script and style elements
    $('script, style, noscript').remove();
    
    // Extract title
    const title = $('title').text().trim() || 
                  $('meta[property="og:title"]').attr('content') || 
                  $('h1').first().text().trim() || 
                  'Untitled';
    
    // Extract ALL content from the page
    // Get the entire body content, including all sections
    const body = $('body');
    
    // Remove only truly non-content elements (scripts, styles, comments)
    // Keep nav, footer, header, aside as they may contain useful content
    body.find('script, style, noscript, iframe, embed, object').remove();
    
    // Get all text content from the body
    let content = body.text();
    
    // Also extract text from common content containers to ensure we get everything
    const contentSelectors = [
      'article', 'main', '.content', '.main-content', '.post-content', 
      '.entry-content', '#content', '#main-content', '[role="main"]',
      'section', '.section', '.article', '.post', '.entry',
      'div.content', 'div.main', 'div.article-content'
    ];
    
    // Collect text from all matching elements (not just first)
    const additionalContent = [];
    contentSelectors.forEach(selector => {
      $(selector).each(function() {
        const text = $(this).text().trim();
        if (text && text.length > 50) { // Only add substantial content
          additionalContent.push(text);
        }
      });
    });
    
    // Combine all content
    if (additionalContent.length > 0) {
      // Merge body content with additional content, removing duplicates
      const allText = [content, ...additionalContent].join('\n\n');
      content = allText;
    }
    
    // Clean up content: normalize whitespace but preserve structure
    content = content
      .replace(/\s{3,}/g, ' ') // Replace 3+ spaces with single space
      .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with double newline
      .trim();
    
    // Extract domain from URL
    let domain = '';
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname;
    } catch (e) {
      domain = url;
    }
    
    return {
      title,
      content,
      domain,
      success: true
    };
  } catch (error) {
    console.error(`Error scraping website ${url}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get page content (for pages, content is already stored)
 */
async function getPageContent(pageId, isTeam) {
  try {
    let page;
    if (isTeam) {
      page = await TeamPage.findById(pageId);
    } else {
      page = await PrivatePage.findById(pageId);
    }
    
    if (!page) {
      return {
        success: false,
        error: 'Page not found'
      };
    }
    
    // Get content from contentHtml field (the actual field name in the models)
    const pageContent = page.contentHtml || '';
    
    return {
      success: true,
      title: page.title || 'Untitled',
      content: pageContent,
      page_type: isTeam ? 'team' : 'private'
    };
  } catch (error) {
    console.error(`Error getting page content:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Ingest a website URL
 */
async function ingestWebsite(url, userCode, sessionCode) {
  try {
    if (!sessionCode) {
      throw new Error('Session code is required for ingestion');
    }
    
    // Check if already ingested for this session
    const existing = await IngestedContent.findOne({
      source_type: 'website',
      url: url,
      session_code: sessionCode
    });
    
    if (existing) {
      console.log(`Website ${url} already ingested`);
      return {
        success: false,
        error: 'Website has already been ingested',
        alreadyExists: true,
        ingested: existing
      };
    }
    
    // Scrape the website
    const scrapeResult = await scrapeWebsite(url);
    
    if (!scrapeResult.success) {
      // Save failed ingestion attempt
      const failedIngestion = new IngestedContent({
        source_type: 'website',
        url: url,
        domain: scrapeResult.domain || '',
        title: scrapeResult.title || '',
        content: '',
        status: 'failed',
        error_message: scrapeResult.error,
        scraped_by: userCode,
        session_code: sessionCode
      });
      await failedIngestion.save();
      
      return {
        success: false,
        error: scrapeResult.error
      };
    }
    
    // Save ingested content
    const ingested = new IngestedContent({
      source_type: 'website',
      url: url,
      domain: scrapeResult.domain,
      title: scrapeResult.title,
      content: scrapeResult.content,
      status: 'completed',
      scraped_by: userCode,
      session_code: sessionCode
    });
    
    await ingested.save();
    
    console.log(`Successfully ingested website: ${url}`);
    
    return {
      success: true,
      ingested: ingested,
      alreadyExists: false
    };
  } catch (error) {
    console.error(`Error ingesting website ${url}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Ingest a page (just mark as ingested, content is already stored)
 */
async function ingestPage(pageId, isTeam, userCode, sessionCode) {
  try {
    if (!sessionCode) {
      throw new Error('Session code is required for ingestion');
    }
    
    // Check if already ingested for this session
    const existing = await IngestedContent.findOne({
      source_type: 'page',
      page_id: pageId,
      page_model: isTeam ? 'TeamPage' : 'PrivatePage',
      session_code: sessionCode
    });
    
    if (existing) {
      console.log(`Page ${pageId} already ingested`);
      return {
        success: false,
        error: 'Page has already been ingested',
        alreadyExists: true,
        ingested: existing
      };
    }
    
    // Get page content
    const pageResult = await getPageContent(pageId, isTeam);
    
    if (!pageResult.success) {
      return {
        success: false,
        error: pageResult.error
      };
    }
    
    // Ensure content is always a string (even if empty)
    const pageContent = (pageResult.content || '').toString();
    
    if (!pageContent.trim()) {
      console.log(`Page ${pageId} has no content, using empty string`);
    }
    
    // Save ingested content (reference to page, content is stored in page model)
    const ingested = new IngestedContent({
      source_type: 'page',
      page_id: pageId,
      page_model: isTeam ? 'TeamPage' : 'PrivatePage',
      page_title: pageResult.title || 'Untitled',
      content: pageContent, // Store content for easy access (can be empty)
      status: 'completed',
      scraped_by: userCode,
      session_code: sessionCode
    });
    
    await ingested.save();
    
    console.log(`Successfully ingested page: ${pageId}`);
    
    return {
      success: true,
      ingested: ingested,
      alreadyExists: false
    };
  } catch (error) {
    console.error(`Error ingesting page ${pageId}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Batch ingest multiple sources
 */
async function batchIngest(sources, userCode, sessionCode = null) {
  const results = {
    pages: { success: [], failed: [] },
    websites: { success: [], failed: [] }
  };
  
  for (const source of sources) {
    try {
      if (source.type === 'page') {
        const result = await ingestPage(
          source.pageId,
          source.isTeam,
          userCode,
          sessionCode
        );
        
        if (result.success) {
          results.pages.success.push({
            pageId: source.pageId,
            isTeam: source.isTeam,
            alreadyExists: result.alreadyExists || false
          });
        } else {
          // Check if it's an "already exists" error
          if (result.alreadyExists) {
            results.pages.failed.push({
              pageId: source.pageId,
              isTeam: source.isTeam,
              error: result.error || 'Page has already been ingested',
              alreadyExists: true
            });
          } else {
            results.pages.failed.push({
              pageId: source.pageId,
              isTeam: source.isTeam,
              error: result.error
            });
          }
        }
      } else if (source.type === 'website') {
        const result = await ingestWebsite(
          source.url,
          userCode,
          sessionCode
        );
        
        if (result.success) {
          results.websites.success.push({
            url: source.url,
            alreadyExists: result.alreadyExists || false
          });
        } else {
          // Check if it's an "already exists" error
          if (result.alreadyExists) {
            results.websites.failed.push({
              url: source.url,
              error: result.error || 'Website has already been ingested',
              alreadyExists: true
            });
          } else {
            results.websites.failed.push({
              url: source.url,
              error: result.error
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error in batch ingest for ${source.type}:`, error);
      if (source.type === 'page') {
        results.pages.failed.push({
          pageId: source.pageId,
          isTeam: source.isTeam,
          error: error.message
        });
      } else {
        results.websites.failed.push({
          url: source.url,
          error: error.message
        });
      }
    }
  }
  
  return results;
}

module.exports = {
  scrapeWebsite,
  getPageContent,
  ingestWebsite,
  ingestPage,
  batchIngest
};

