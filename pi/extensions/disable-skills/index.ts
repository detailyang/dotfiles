import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface Config {
    enable: boolean;
}

const DEFAULT_CONFIG: Config = { enable: true };
const CONFIG_NAME = "disable-skills.json";
const SKILLS_SECTION_RE = /\n\nThe following skills[\s\S]*?<\/available_skills>/;

function loadConfig(cwd: string): Config {
    const globalPath = join(getAgentDir(), "extensions", CONFIG_NAME);
    const projectPath = join(cwd, ".pi", CONFIG_NAME);

    let config = { ...DEFAULT_CONFIG };

    for (const path of [globalPath, projectPath]) {
        if (!existsSync(path)) continue;
        try {
            const partial = JSON.parse(readFileSync(path, "utf-8"));
            config = { ...config, ...partial };
        } catch (e) {
            console.error(`Warning: Could not parse ${path}: ${e}`);
        }
    }

    return config;
}

export default function disableModelSkillInvocation(pi: ExtensionAPI) {
    let enable = true;

    pi.on("session_start", (_event, ctx) => {
        enable = loadConfig(ctx.cwd).enable;
    });

    pi.on("before_agent_start", async (event) => {
        if (!enable) return;

        const stripped = event.systemPrompt.replace(SKILLS_SECTION_RE, "");
        if (stripped === event.systemPrompt) return;

        return { systemPrompt: stripped };
    });
}
