import path from "node:path";
import { promises as fs } from "node:fs";

export type ReviewPathStat = {
	isFile(): boolean;
	isDirectory(): boolean;
};

export type StatReviewPath = (resolvedPath: string) => Promise<ReviewPathStat>;

async function defaultStatReviewPath(resolvedPath: string): Promise<ReviewPathStat> {
	return fs.stat(resolvedPath);
}

export async function validateReviewPaths(
	cwd: string,
	paths: string[],
	statPath: StatReviewPath = defaultStatReviewPath,
): Promise<string[]> {
	const validated: string[] = [];
	const resolvedCwd = path.resolve(cwd);
	for (const rawPath of paths) {
		const resolved = path.resolve(cwd, rawPath);
		if (!resolved.startsWith(resolvedCwd + path.sep) && resolved !== resolvedCwd) {
			throw new Error(`Review path must be inside the working directory: ${rawPath}`);
		}
		const stat = await statPath(resolved).catch((error: NodeJS.ErrnoException) => {
			if (error.code === "ENOENT") {
				throw new Error(`Review path does not exist: ${rawPath}`);
			}
			throw new Error(`Failed to inspect review path ${rawPath}: ${error.message}`);
		});
		if (!stat.isFile() && !stat.isDirectory()) {
			throw new Error(`Review path is not a file or directory: ${rawPath}`);
		}
		validated.push(rawPath);
	}
	return validated;
}
