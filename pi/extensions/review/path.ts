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
	realPath: (value: string) => Promise<string> = fs.realpath,
): Promise<string[]> {
	const validated: string[] = [];
	const resolvedCwd = path.resolve(cwd);
	const canonicalCwd = await realPath(resolvedCwd);
	const inside = (root: string, candidate: string) => {
		const relative = path.relative(root, candidate);
		return !path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`);
	};
	for (const rawPath of paths) {
		const resolved = path.resolve(cwd, rawPath);
		if (!inside(resolvedCwd, resolved)) {
			throw new Error(`Review path must be inside the working directory: ${rawPath}`);
		}
		const pathError = (error: NodeJS.ErrnoException): never => {
			if (error.code === "ENOENT") {
				throw new Error(`Review path does not exist: ${rawPath}`);
			}
			throw new Error(`Failed to inspect review path ${rawPath}: ${error.message}`);
		};
		const canonical = await realPath(resolved).catch(pathError);
		if (!inside(canonicalCwd, canonical)) {
			throw new Error(`Review path resolves outside the working directory: ${rawPath}`);
		}
		const stat = await statPath(canonical).catch(pathError);
		if (!stat.isFile() && !stat.isDirectory()) {
			throw new Error(`Review path is not a file or directory: ${rawPath}`);
		}
		validated.push(rawPath);
	}
	return validated;
}
