# Backend General - Movie Recommendation API

This is the backend API service for the movie recommendation application, designed to be deployed as a serverless function on Vercel.

## Features

- **Autocomplete Suggestions**: Get movie/TV show suggestions based on search terms
- **Recommendations**: Fetch detailed recommendations for specific movies/TV shows
- **Health Check**: Monitor service status

## API Endpoints

### GET /api/suggestions
Get autocomplete suggestions for movies/TV shows.

**Query Parameters:**
- `term` (required): Search term for suggestions

**Example:**
```
GET /api/suggestions?term=inception
```

### GET /api/recommendations
Get detailed recommendations for a specific movie/TV show.

**Query Parameters:**
- `url` (required): The relative URL path from bestsimilar.com

**Example:**
```
GET /api/recommendations?url=/movies/inception-2010
```

### GET /health
Health check endpoint to verify service status.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Development

### Local Development
```bash
npm install
npm run dev
```

The server will start on `http://localhost:3001`

### Deployment to Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Login to Vercel: `vercel login`
3. Deploy: `vercel --prod`

## Environment Variables

- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment mode

## Dependencies

- **express**: Web framework
- **cors**: Cross-origin resource sharing middleware