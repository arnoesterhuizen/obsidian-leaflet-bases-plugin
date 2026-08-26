import { LatLng, LatLngExpression } from "leaflet";

/**
 * Builds a tapered polygon outline from a river centerline.
 *
 * The polygon widens linearly from `startWidth` at the first coordinate
 * to `endWidth` at the last coordinate, with optional random variation
 * applied per-vertex for a natural look.
 *
 * @param coords - River centerline points (source first, mouth last)
 * @param startWidth - Width at the source (geographic units, e.g. degrees)
 * @param endWidth - Width at the mouth (geographic units)
 * @param seed - Deterministic seed for noise (use feature index or hash)
 * @returns Closed polygon outline as LatLng pairs (left bank + right bank reversed)
 */
export function buildRiverPolygon(
	coords: LatLng[],
	startWidth: number,
	endWidth: number,
	seed: number,
): LatLngExpression[] {
	if (coords.length < 2) return [];

	const left: LatLngExpression[] = [];
	const right: LatLngExpression[] = [];

	for (let i = 0; i < coords.length; i++) {
		const t = coords.length > 1 ? i / (coords.length - 1) : 0;
		const baseHalfWidth = (startWidth + (endWidth - startWidth) * t) / 2;

		// Apply minor random variation (up to +/-15% of base width)
		const noise = seededNoise(seed, i) * 0.15;
		const halfWidth = baseHalfWidth * (1 + noise);

		const normal = computeNormal(coords, i);

		left.push([
			coords[i]!.lat + normal.lat * halfWidth,
			coords[i]!.lng + normal.lng * halfWidth,
		]);
		right.unshift([
			coords[i]!.lat - normal.lat * halfWidth,
			coords[i]!.lng - normal.lng * halfWidth,
		]);
	}

	return [...left, ...right];
}

/**
 * Compute the unit normal (perpendicular) vector at a given point along the polyline.
 * At endpoints, uses the adjacent segment direction. At interior points, averages
 * the normals of the two adjacent segments for a smooth outline.
 */
function computeNormal(coords: LatLng[], index: number): { lat: number; lng: number } {
	let dx: number;
	let dy: number;

	if (index === 0) {
		// First point: use direction to next point
		dx = coords[1]!.lng - coords[0]!.lng;
		dy = coords[1]!.lat - coords[0]!.lat;
	} else if (index === coords.length - 1) {
		// Last point: use direction from previous point
		dx = coords[index]!.lng - coords[index - 1]!.lng;
		dy = coords[index]!.lat - coords[index - 1]!.lat;
	} else {
		// Interior point: average of two adjacent segment directions
		const dx1 = coords[index]!.lng - coords[index - 1]!.lng;
		const dy1 = coords[index]!.lat - coords[index - 1]!.lat;
		const dx2 = coords[index + 1]!.lng - coords[index]!.lng;
		const dy2 = coords[index + 1]!.lat - coords[index]!.lat;
		dx = dx1 + dx2;
		dy = dy1 + dy2;
	}

	// Perpendicular: rotate 90 degrees (swap and negate one)
	const length = Math.sqrt(dx * dx + dy * dy);
	if (length === 0) return { lat: 0, lng: 0 };

	// Normal points "left" of the direction of travel
	return { lat: dx / length, lng: -dy / length };
}

/**
 * Deterministic pseudo-random noise for a given seed and index.
 * Returns a value in [-1, 1]. Uses a simple hash-based approach
 * so the same river always looks the same.
 */
function seededNoise(seed: number, index: number): number {
	const x = Math.sin(seed * 9301 + index * 49297 + 0.1) * 49979;
	return (x - Math.floor(x)) * 2 - 1;
}
