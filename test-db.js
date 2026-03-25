const { Client } = require("pg");
const client = new Client({ connectionString: "postgresql://postgres:9989882989@m@localhost:5432/mint_web" });
client.connect().then(() => {
  client.query("SELECT config_json->>'designData' IS NOT NULL as has_design_data, config_json->>'framework' as fw FROM project_commits ORDER BY created_at DESC LIMIT 5")
    .then(res => console.log(res.rows))
    .catch(e => console.error(e))
    .finally(() => client.end());
});
