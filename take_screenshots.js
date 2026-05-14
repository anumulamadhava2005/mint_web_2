const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    if (!fs.existsSync('public/images')) {
      fs.mkdirSync('public/images', { recursive: true });
    }

    console.log("Taking screenshot of Home Page...");
    await page.goto('http://localhost:3000/home', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: 'public/images/doc-home.png' });

    console.log("Taking screenshot of Login Page...");
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: 'public/images/doc-login.png' });

    // Try logging in to get to the projects page
    console.log("Attempting to log in...");
    await page.type('input[placeholder="Username"]', 'manimadhava43@gmail.com');
    await page.type('input[placeholder="••••••••"]', '9989882989@m');
    await page.click('button[data-name="LoginButton"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    console.log("Taking screenshot of Projects Page...");
    await page.screenshot({ path: 'public/images/doc-projects.png' });

    // Wait, the preview page needs a project ID. Let's just grab a screenshot of whatever is there, maybe click a project.
    // We can also take a screenshot of the signup page.
    console.log("Taking screenshot of Signup Page...");
    await page.goto('http://localhost:3000/signup', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: 'public/images/doc-signup.png' });

    // Docs page
    console.log("Taking screenshot of Docs Page...");
    await page.goto('http://localhost:3000/docs', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: 'public/images/doc-docs.png' });

    await browser.close();
    console.log("All screenshots captured!");
  } catch (err) {
    console.error("Error capturing screenshots:", err);
    process.exit(1);
  }
})();
