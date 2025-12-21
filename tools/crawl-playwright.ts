import { chromium, Page } from "playwright";
import fs from "fs";

const BASE =
    "https://vtuberdiscovery.com/list?q=&debut_from=&debut_to=&subs_range=0-500&page=";

const MAX_PAGE = 2;
const WAIT = 2000;

const sleep = (ms: number) =>
    new Promise(r => setTimeout(r, ms));

async function extractHandleFromYouTube(
    page: Page,
    channelUrl: string
): Promise<string | null> {
    console.log("     → open youtube:", channelUrl);

    await page.goto(channelUrl, {
        waitUntil: "networkidle",
        timeout: 30000,
    });

    // ハンドル表示を待つ（class 名ベタ指定）
    await page.waitForSelector(
        "span.yt-core-attributed-string--link-inherit-color",
        { timeout: 15000 }
    );

    const handle = await page.$eval(
        "span.yt-core-attributed-string--link-inherit-color",
        el => el.textContent?.trim() ?? ""
    );

    return handle.startsWith("@") ? handle : null;
}

async function main() {
    const browser = await chromium.launch({
        headless: true, // 安定するまで false 推奨
        slowMo: 200,
    });

    const page = await browser.newPage();
    const results = new Set<string>();

    for (let p = 1; p <= MAX_PAGE; p++) {
        console.log(`\n🔍 List page ${p}`);
        await page.goto(`${BASE}${p}`, {
            waitUntil: "networkidle",
        });

        // VTuberDiscovery 側で YouTube チャンネル URL を取得
        const youtubeLinks = await page.$$eval(
            'a[href*="youtube.com/channel"]',
            as => as.map(a => a.getAttribute("href")!)
        );

        console.log(`   youtube links found: ${youtubeLinks.length}`);

        for (const yt of youtubeLinks) {
            try {
                const handle = await extractHandleFromYouTube(page, yt);
                if (!handle) {
                    console.log("     ⚠ handle not found");
                    continue;
                }

                console.log("     ✔ handle:", handle);
                results.add(handle);

                await sleep(WAIT);
            } catch (e) {
                console.log("     ❌ failed, skip");
            }
        }
    }

    await browser.close();

    fs.writeFileSync(
        "vtuber_handles.csv",
        "handle\n" + [...results].join("\n"),
        "utf8"
    );

    console.log(`\n✅ 完了: ${results.size} 件`);
}

main().catch(console.error);
