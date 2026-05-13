import { formatSkillsForPrompt, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SKILLS_SECTION_RE =
	/\n\n(?:[^\n]+\n){0,5}<available_skills>[\s\S]*?<\/available_skills>/;

export default function disableModelSkillInvocation(pi: ExtensionAPI) {
	pi.on("before_agent_start", async (event) => {
		const skills = event.systemPromptOptions.skills ?? [];

		if (skills.length === 0 || !formatSkillsForPrompt(skills)) {
			return;
		}

		const stripped = event.systemPrompt.replace(SKILLS_SECTION_RE, "");

		if (stripped === event.systemPrompt) {
			return;
		}

		return { systemPrompt: stripped };
	});
}
