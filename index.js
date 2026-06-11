const express = require("express");
const fs = require("fs");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.static("public"));

// Load dataset once at startup
const data = JSON.parse(
  fs.readFileSync("nz-speed-cameras-FINAL.geojson", "utf-8")
);

// -----------------------------
// Helpers
// -----------------------------
function distance(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;

  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// -----------------------------
// Routes
// -----------------------------

// ✅ All cameras
app.get("/cameras", (req, res) => {
  res.json(data);
});

// ✅ Filter by region/suburb/type
app.get("/cameras/search", (req, res) => {
  const { region, suburb, type } = req.query;

  let results = data.features;

  if (region) {
    results = results.filter(f =>
      f.properties.region.toLowerCase().includes(region.toLowerCase())
    );
  }

  if (suburb) {
    results = results.filter(f =>
      f.properties.suburb.toLowerCase().includes(suburb.toLowerCase())
    );
  }

  if (type) {
    results = results.filter(f =>
      f.properties.cameraType.toLowerCase().includes(type.toLowerCase())
    );
  }

  res.json({
    type: "FeatureCollection",
    features: results
  });
});

// ✅ Nearby cameras (lat, lng, radius km)
app.get("/cameras/nearby", (req, res) => {
  const { lat, lng, radius = 5 } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: "lat and lng required" });
  }

  const results = data.features.filter(f => {
    const [lon, lat2] = f.geometry.coordinates;
    const d = distance(Number(lat), Number(lng), lat2, lon);
    return d <= radius;
  });

  res.json({
    type: "FeatureCollection",
    features: results
  });
});

// ✅ Single camera
app.get("/cameras/:id", (req, res) => {
  const cam = data.features.find(
    f => f.properties.id === req.params.id
  );

  if (!cam) return res.status(404).json({ error: "Not found" });

  res.json(cam);
});

// -----------------------------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 API running on http://localhost:${PORT}`);
});