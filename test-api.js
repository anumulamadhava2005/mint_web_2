const http = require('http');

http.get('http://localhost:3000/api/commit?projectId=test-project', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log("Commits:", parsed.commits ? parsed.commits.length : 0);
      if (parsed.commits && parsed.commits.length > 0) {
        const projectId = 'test-project'; // wait, project ID isn't test-project, I need to find the real project ID used in PenpotEditor
      }
    } catch (e) { console.error(e) }
  });
});
