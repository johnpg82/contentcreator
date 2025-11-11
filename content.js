// Content script that runs on thebash.com to extract content

(function() {
  'use strict';

  // Function to extract bash quotes from the page
  function extractBashContent() {
    const content = {
      quotes: [],
      pageTitle: document.title,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };

    // Extract individual quotes from the page
    // thebash.com typically displays quotes in specific containers
    const quoteElements = document.querySelectorAll('.quote, .bash-quote, p.qt');

    if (quoteElements.length > 0) {
      quoteElements.forEach((element, index) => {
        const text = element.textContent.trim();
        if (text) {
          content.quotes.push({
            id: index + 1,
            text: text,
            html: element.innerHTML
          });
        }
      });
    } else {
      // Fallback: try to extract text from common containers
      const containers = document.querySelectorAll('p, .text, .content');
      containers.forEach((element, index) => {
        const text = element.textContent.trim();
        // Only add if it looks like a quote (reasonable length, not navigation text)
        if (text && text.length > 20 && text.length < 5000) {
          content.quotes.push({
            id: index + 1,
            text: text,
            html: element.innerHTML
          });
        }
      });
    }

    // Extract additional metadata
    const ratingElements = document.querySelectorAll('.rating, .score, .votes');
    if (ratingElements.length > 0) {
      content.ratings = Array.from(ratingElements).map(el => el.textContent.trim());
    }

    return content;
  }

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractContent') {
      const content = extractBashContent();
      sendResponse({ success: true, data: content });
    }
    return true; // Keep the message channel open for async response
  });

  // Automatically extract content when page loads and store it
  window.addEventListener('load', () => {
    const content = extractBashContent();

    // Store the extracted content in chrome.storage
    chrome.storage.local.set({
      'latestContent': content
    }, () => {
      console.log('TheBash.com content extracted and stored:', content);
    });
  });

  console.log('TheBash.com Content Reader extension loaded');
})();
