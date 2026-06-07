async function main() {
    const res = await fetch("https://api.mintit.pro/api/mint-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text:"SELECT * FROM files where project_id = '88c00748-ef23-4aa5-b8a9-3f2c6ab13528'", params: [] }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error("HTTP " + res.status + ": " + errText);
    }
    console.log((await res.json()).rows[0].data.pagesIndex.page1.objects);
}
main();
