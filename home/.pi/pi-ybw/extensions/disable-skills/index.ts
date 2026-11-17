import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface Config {
    enable: boolean;
}

const DEFAULT_CONFIG: Config = { enable: true };
const CONFIG_NAME = "disable-skills.json";
const SKILLS_SECTION_RE = /(?:^|\r?\n)The following skills provide specialized instructions for specific tasks\.[\s\S]*?<available_skills>[\s\S]*?<\/available_skills>/;

function loadConfig(
    cwd: string,
    projectTrusted: boolean,
    warn?: (message: string) => void,
): Config {
    const paths = [join(getAgentDir(), "extensions", CONFIG_NAME)];
    if (projectTrusted) {
        paths.push(join(cwd, ".pi", CONFIG_NAME));
    }

    let config = { ...DEFAULT_CONFIG };

    for (const path of paths) {
        if (!existsSync(path)) continue;
        try {
            const partial = JSON.parse(readFileSync(path, "utf-8"));
            if (typeof partial === "object" && partial !== null && typeof partial.enable === "boolean") {
                config = { enable: partial.enable };
            }
        } catch (e) {
            warn?.(`Could not parse ${path}: ${e}`);
        }
    }

    return config;
}

export default function disableModelSkillInvocation(pi: ExtensionAPI) {
    let enable = true;

    pi.on("session_start", (_event, ctx) => {
        const trusted = ctx.isProjectTrusted?.() !== false;
        enable = loadConfig(ctx.cwd, trusted, (msg) => ctx.ui?.notify?.(msg, "warning")).enable;
    });

    pi.on("before_agent_start", async (event) => {
        if (!enable) return;

        const stripped = event.systemPrompt.replace(SKILLS_SECTION_RE, "");
        if (stripped === event.systemPrompt) return;

        return { systemPrompt: stripped };
    });
}
