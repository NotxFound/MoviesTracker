export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const { action, type, id, query, season } = req.query;

    const API_KEY = process.env.TMDB_API_KEY;
    const BASE_URL = "https://api.themoviedb.org/3";

    if (!API_KEY) {
        console.error("TMDB_API_KEY not found in environment variables");
        return res.status(500).json({ error: "API key not configured" });
    }

    let url;

    try {
        switch (action) {
            case "search":
                if (!query) return res.status(400).json({ error: "Missing query" });
                if (type === "movie") {
                    url = `${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=pl-PL`;
                } else if (type === "tv") {
                    url = `${BASE_URL}/search/tv?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=pl-PL`;
                } else {
                    url = `${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=pl-PL`;
                }
                break;

            case "details":
                if (!id || !type) return res.status(400).json({ error: "Missing id or type" });
                url = `${BASE_URL}/${type}/${id}?api_key=${API_KEY}&language=pl-PL`;
                break;

            case "tv":
                if (!id) return res.status(400).json({ error: "Missing TV show id" });
                if (season) {
                    url = `${BASE_URL}/tv/${id}/season/${season}?api_key=${API_KEY}&language=pl-PL`;
                } else {
                    url = `${BASE_URL}/tv/${id}?api_key=${API_KEY}&language=pl-PL`;
                }
                break;

            default:
                return res.status(400).json({ error: "Invalid action" });
        }

        console.log("Fetching from URL:", url);
        const response = await fetch(url);

        if (!response.ok) {
            console.error("TMDB API response not ok:", response.status, response.statusText);
            return res.status(response.status).json({ error: `TMDB API error: ${response.statusText}` });
        }

        const data = await response.json();
        res.status(200).json(data);

    } catch (err) {
        console.error("TMDB API error:", err);
        res.status(500).json({ error: "Failed to fetch from TMDB", details: err.message });
    }
}