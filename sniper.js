"use strict";

const tls = require("tls");
const WebSocket = require("ws");
const extractJSON = require("extract-json-from-string");

let vanity;
const guilds = {};
let start;
let end;

const tlsSocket = tls.connect({
    host: "canary.discord.com",
    port: 443,
});

tlsSocket.on("data", async (data) => {
    const ext = extractJSON(data.toString());
    const find = ext.find(e => e.code) || ext.find(e => e.message);

    if (find) {
        end = Date.now();
        console.log(find);

        const requestBody = JSON.stringify({
            content: `@everyone ${vanity} \n\`\`\`json\n${JSON.stringify(find)}\`\`\``,
        });

        const requestHeader = [
            "POST /api/v7/channels/1271098159338356777/messages HTTP/1.1",
            "Host: canary.discord.com",
            "Authorization: MTI2NTI3NzA1OTIxOTk4MDI4OA.G70WHH.mGTqABNgbe29NEC4YQAzt5nKC43uGfXACedh6Q",
            "Content-Type: application/json",
            `Content-Length: ${Buffer.byteLength(requestBody)}`,
            "",
            "",
        ].join("\r\n");

        tlsSocket.write(requestHeader + requestBody);
    }
});

tlsSocket.on("error", (error) => {
    console.error("tls error", error);
    process.exit();
});

tlsSocket.on("end", () => {
    console.log("tls connection closed");
    process.exit();
});

tlsSocket.on("secureConnect", () => {
    const websocket = new WebSocket("wss://gateway-us-east1-b.discord.gg");

    websocket.onclose = (event) => {
        console.log(`ws connection closed ${event.reason} ${event.code}`);
        process.exit();
    };

    websocket.onmessage = async (message) => {
        const { d, op, t } = JSON.parse(message.data);

        if (t === "GUILD_UPDATE") {
            const find = guilds[d.guild_id];
            if (find && find !== d.vanity_url_code) {
                start = Date.now();
                const requestBody = JSON.stringify({ code: find });

                tlsSocket.write([
                    "PATCH /api/v7/guilds/1261212466482778112/vanity-url HTTP/1.1",
                    "Host: canary.discord.com",
                    'Authorization: MTI2NTI3NzA1OTIxOTk4MDI4OA.G70WHH.mGTqABNgbe29NEC4YQAzt5nKC43uGfXACedh6Q',
                    "Content-Type: application/json",
                    `Content-Length: ${Buffer.byteLength(requestBody)}`,
                    "",
                    "",
                ].join("\r\n") + requestBody);

                vanity = `${find} UP`;
            }
        } else if (t === "GUILD_DELETE") {
            const find = guilds[d.id];
            if (find) {
                const requestBody = JSON.stringify({ code: find });

                tlsSocket.write([
                    "PATCH /api/v7/guilds/1261212466482778112/vanity-url HTTP/1.1",
                    "Host: canary.discord.com",
                    'Authorization: MTI2NTI3NzA1OTIxOTk4MDI4OA.G70WHH.mGTqABNgbe29NEC4YQAzt5nKC43uGfXACedh6Q',
                    "Content-Type: application/json",
                    `Content-Length: ${Buffer.byteLength(requestBody)}`,
                    "",
                    "",
                ].join("\r\n") + requestBody);

                vanity = `${find} DT`;
            }
        } else if (t === "READY") {
            d.guilds.forEach((guild) => {
                if (guild.vanity_url_code) {
                    guilds[guild.id] = guild.vanity_url_code;
                } else {
                    console.log(guild.name);
                }
            });
            console.log(guilds);
        }

        if (op === 10) {
            websocket.send(JSON.stringify({
                op: 2,
                d: {
                    token: "MTI2NTI3NzA1OTIxOTk4MDI4OA.G70WHH.mGTqABNgbe29NEC4YQAzt5nKC43uGfXACedh6Q",
                    intents: 513,
                    properties: {
                        os: "MacOs",
                        browser: "FireFox",
                        device: "desktop",
                    },
                },
            }));
            setInterval(() => websocket.send(JSON.stringify({ op: 1, d: null })), d.heartbeat_interval);
        } else if (op === 7) {
            process.exit();
        }
    };

    setInterval(() => {
        tlsSocket.write(["GET / HTTP/1.1", "Host: canary.discord.com", "", ""].join("\r\n"));
    }, 7500);
});
