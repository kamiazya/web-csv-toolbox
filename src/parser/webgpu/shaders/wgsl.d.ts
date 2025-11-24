/**
 * TypeScript declarations for importing WGSL shader files
 */

declare module "*.wgsl" {
	const content: string;
	export default content;
}

declare module "*.wgsl?raw" {
	const content: string;
	export default content;
}
