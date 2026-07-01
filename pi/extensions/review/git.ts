export type ReviewExecResult = {
	stdout: string;
	stderr?: string;
	code: number;
};

export type ReviewExecHost = {
	exec(cmd: string, args: string[]): Promise<ReviewExecResult>;
};

export async function getMergeBase(host: ReviewExecHost, branch: string): Promise<string | null> {
	try {
		const { stdout: upstream, code: upstreamCode } = await host.exec("git", [
			"rev-parse",
			"--abbrev-ref",
			`${branch}@{upstream}`,
		]);

		if (upstreamCode === 0 && upstream.trim()) {
			const { stdout: mergeBase, code } = await host.exec("git", ["merge-base", "HEAD", upstream.trim()]);
			if (code === 0 && mergeBase.trim()) {
				return mergeBase.trim();
			}
		}

		const { stdout: mergeBase, code } = await host.exec("git", ["merge-base", "HEAD", branch]);
		if (code === 0 && mergeBase.trim()) {
			return mergeBase.trim();
		}

		return null;
	} catch {
		return null;
	}
}

export async function getLocalBranches(host: ReviewExecHost): Promise<string[]> {
	const { stdout, code } = await host.exec("git", ["branch", "--format=%(refname:short)"]);
	if (code !== 0) return [];
	return stdout
		.trim()
		.split("\n")
		.filter((branch) => branch.trim());
}

export async function getRecentCommits(host: ReviewExecHost, limit: number = 10): Promise<Array<{ sha: string; title: string }>> {
	const { stdout, code } = await host.exec("git", ["log", `--oneline`, `-n`, `${limit}`]);
	if (code !== 0) return [];

	return stdout
		.trim()
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => {
			const [sha, ...rest] = line.trim().split(" ");
			return { sha, title: rest.join(" ") };
		});
}

export async function hasUncommittedChanges(host: ReviewExecHost): Promise<boolean> {
	const { stdout, code } = await host.exec("git", ["status", "--porcelain"]);
	return code === 0 && stdout.trim().length > 0;
}

export async function hasPendingChanges(host: ReviewExecHost): Promise<boolean> {
	const { stdout, code } = await host.exec("git", ["status", "--porcelain"]);
	if (code !== 0) return false;

	const lines = stdout.trim().split("\n").filter((line) => line.trim());
	const trackedChanges = lines.filter((line) => !line.startsWith("??"));
	return trackedChanges.length > 0;
}

export async function getPrInfo(host: ReviewExecHost, prNumber: number): Promise<{ baseBranch: string; title: string; headBranch: string } | null> {
	const { stdout, code } = await host.exec("gh", [
		"pr", "view", String(prNumber),
		"--json", "baseRefName,title,headRefName",
	]);

	if (code !== 0) return null;

	try {
		const data = JSON.parse(stdout);
		return {
			baseBranch: data.baseRefName,
			title: data.title,
			headBranch: data.headRefName,
		};
	} catch {
		return null;
	}
}

export async function checkoutPr(host: ReviewExecHost, prNumber: number): Promise<{ success: boolean; error?: string }> {
	const { stdout, stderr, code } = await host.exec("gh", ["pr", "checkout", String(prNumber)]);

	if (code !== 0) {
		return { success: false, error: stderr || stdout || "Failed to checkout PR" };
	}

	return { success: true };
}

export async function getCurrentBranch(host: ReviewExecHost): Promise<string | null> {
	const { stdout, code } = await host.exec("git", ["branch", "--show-current"]);
	if (code === 0 && stdout.trim()) {
		return stdout.trim();
	}
	return null;
}

export async function getDefaultBranch(host: ReviewExecHost): Promise<string> {
	const { stdout, code } = await host.exec("git", ["symbolic-ref", "refs/remotes/origin/HEAD", "--short"]);
	if (code === 0 && stdout.trim()) {
		return stdout.trim().replace("origin/", "");
	}

	const branches = await getLocalBranches(host);
	if (branches.includes("main")) return "main";
	if (branches.includes("master")) return "master";

	return "main";
}
