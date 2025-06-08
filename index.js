import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Autocomplete suggestions endpoint
app.get('/api/suggestions', async (req, res) => {
  try {
    const term = req.query.term;
    
    if (!term) {
      return res.status(400).json({ error: 'Term parameter is required' });
    }

    const url = `https://bestsimilar.com/site/autocomplete?term=${encodeURIComponent(term)}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://bestsimilar.com/',
        'Origin': 'https://bestsimilar.com'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// Helper function to extract movie ID from URL or HTML
const extractMovieId = (url, html) => {
  // Try to extract from URL first (e.g., /movies/26240-game-of-thrones)
  const urlMatch = url.match(/\/(?:movies|tv)\/(\d+)-/);
  if (urlMatch) {
    return urlMatch[1];
  }
  
  // If not found in URL, try to extract from HTML
  const htmlMatch = html.match(/id['"]\s*:\s*['"]?(\d+)['"]?/);
  if (htmlMatch) {
    return htmlMatch[1];
  }
  
  // Try another pattern for movie ID in HTML
  const idMatch = html.match(/data-id=['"](\d+)['"]/);
  if (idMatch) {
    return idMatch[1];
  }
  
  return null;
};

// Helper function to parse movie data from HTML
const parseMovieData = (html) => {
  // Create a simple HTML parser using regex (since we can't use DOMParser in Node.js)
  const movieElements = [];
  
  // Match all column elements (which contain both column-img and potential TV show labels)
  const columnRegex = /<div[^>]*class="[^"]*column[^"]*"[^>]*>(.*?)<\/div>/gs;
  let match;
  
  while ((match = columnRegex.exec(html)) !== null) {
    const columnHtml = match[1];
    
    // Extract image data from column-img within this column
    const imgMatch = columnHtml.match(/<div[^>]*class="[^"]*column-img[^"]*"[^>]*>.*?<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*(?:data-id="([^"]*)")?[^>]*>.*?<\/div>/s);
    if (imgMatch) {
      const [, src, alt, dataId] = imgMatch;
      
      // Extract year from alt text
      const yearMatch = alt.match(/\((\d{4})\)/);
      const year = yearMatch ? yearMatch[1] : '';
      
      // Check for TV show indicator - look for the label within this specific column
      const isTvShow = columnHtml.includes('label-default') && columnHtml.includes('TV show');
      
      movieElements.push({
        id: dataId || Math.random().toString(),
        title: alt.replace(/\s*\(\d{4}\)/, ''),
        poster: src.startsWith('/') ? `https://bestsimilar.com${src}` : src,
        year,
        type: isTvShow ? 'tv' : 'movie'
      });
    }
  }
  
  return movieElements.filter(movie => movie.poster && movie.title);
};

// Movie/TV show recommendations endpoint
app.get('/api/recommendations', async (req, res) => {
  try {
    const url = req.query.url;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    const fullUrl = `https://bestsimilar.com${url}`;
    
    // Fetch the first page
    const firstPageResponse = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.5',
        'Referer': 'https://bestsimilar.com/',
        'Origin': 'https://bestsimilar.com'
      }
    });

    if (!firstPageResponse.ok) {
      throw new Error(`HTTP error! status: ${firstPageResponse.status}`);
    }

    const firstPageHtml = await firstPageResponse.text();
    
    // Extract movie ID from the first page
    const movieId = extractMovieId(url, firstPageHtml);
    
    if (!movieId) {
      console.error('Could not extract movie ID from URL or HTML');
      return res.send(firstPageHtml); // Fallback to original behavior
    }

    console.log(`Extracted movie ID: ${movieId}`);
    
    // Parse first page data
    let allMovies = parseMovieData(firstPageHtml);
    console.log(`First page: ${allMovies.length} movies found`);
    
    // Fetch additional pages
    let currentPage = 2;
    const maxPages = 20; // Safety limit to prevent infinite loops
    
    while (currentPage <= maxPages) {
      try {
        console.log(`Fetching page ${currentPage}...`);
        
        const pageUrl = `https://bestsimilar.com/movies/rel?id=${movieId}&order=0&page=${currentPage}`;
        
        const pageResponse = await fetch(pageUrl, {
          headers: {
            'accept': '*/*',
            'accept-language': 'en-GB,en;q=0.5',
            'priority': 'u=1, i',
            'referer': fullUrl,
            'sec-ch-ua': '"Brave";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Linux"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'sec-gpc': '1',
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
            'x-requested-with': 'XMLHttpRequest'
          }
        });
        
        if (pageResponse.status === 404) {
          console.log(`Page ${currentPage} returned 404, stopping pagination`);
          break;
        }
        
        if (!pageResponse.ok) {
          console.log(`Page ${currentPage} failed with status ${pageResponse.status}, stopping pagination`);
          break;
        }
        
        const pageHtml = await pageResponse.text();
        
        // Check if page is empty or has no content
        if (!pageHtml.trim() || pageHtml.length < 100) {
          console.log(`Page ${currentPage} appears to be empty, stopping pagination`);
          break;
        }
        
        const pageMovies = parseMovieData(pageHtml);
        
        if (pageMovies.length === 0) {
          console.log(`Page ${currentPage} has no movies, stopping pagination`);
          break;
        }
        
        console.log(`Page ${currentPage}: ${pageMovies.length} movies found`);
        allMovies = allMovies.concat(pageMovies);
        currentPage++;
        
        // Add a small delay to be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (pageError) {
        console.error(`Error fetching page ${currentPage}:`, pageError.message);
        break;
      }
    }
    
    console.log(`Total movies collected: ${allMovies.length} from ${currentPage - 1} pages`);
    
    // Create a combined HTML response with all movies in the expected structure
    const combinedHtml = `
      <html>
        <body>
          ${allMovies.map(movie => `
            <div class="column">
              <div class="column-img">
                <img src="${movie.poster}" alt="${movie.title}${movie.year ? ` (${movie.year})` : ''}" data-id="${movie.id}" />
              </div>
              ${movie.type === 'tv' ? '<span class="label label-default">TV show</span>' : ''}
            </div>
          `).join('')}
        </body>
      </html>
    `;
    
    res.send(combinedHtml);
    
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// For Vercel serverless deployment
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
    console.log(`Available endpoints:`);
    console.log(`  - GET /api/suggestions?term=<search_term>`);
    console.log(`  - GET /api/recommendations?url=<movie_url>`);
    console.log(`  - GET /health`);
  });
}

export default app;