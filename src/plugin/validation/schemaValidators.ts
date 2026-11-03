import { markerSchema, pathSchema, regionSchema } from "@plugin/properties/propertySchemas";
import { MarkerObject, PathObject, RegionObject, Schema, StringMap, ValidatorFunction } from "@plugin/types";
import { Validator } from "./validators";

export function schemaValidatorFactory<T extends StringMap>(
	schema: Schema<string>,
): ValidatorFunction<T> {
	function schemaValidator(value: unknown): value is T {
		if (!Validator.stringMap(value)) return false;

		return Object.entries(schema)
			.map(([key, validate]) => {
				return (value[key] === undefined && !validate.required) || validate.validator(value[key]);
			})
			.every(Boolean);
	}
	return schemaValidator;
}

export const SchemaValidator = {
	marker: schemaValidatorFactory<MarkerObject>(markerSchema),
	region: schemaValidatorFactory<RegionObject>(regionSchema),
	path: schemaValidatorFactory<PathObject>(pathSchema),
} as const satisfies Record<string, ValidatorFunction<StringMap>>;
