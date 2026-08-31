import { MarkerObject, PathObject, RegionObject, Schema } from "@plugin/types";
import { Validator } from "@plugin/validation/validators";

export const markerSchema: Schema<keyof MarkerObject> = {
	coordinates: { validator: Validator.coordinates, required: true },
	map: { validator: Validator.stringOrStringArray },
};

export const regionSchema: Schema<keyof RegionObject> = {
	coordinates: { validator: Validator.string, required: true },
	map: { validator: Validator.string },
	color: { validator: Validator.string },
};

export const pathSchema: Schema<keyof PathObject> = {
	coordinates: { validator: Validator.string, required: true },
	map: { validator: Validator.string },
	color: { validator: Validator.string },
};
