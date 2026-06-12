const fs = require("fs/promises");
const path = require("path");

module.exports = async function handler(req, res) {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data", "predictions.json"), "utf8");
    res.setHeader("cache-control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json(JSON.parse(raw));
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo leer la porra" });
  }
};
