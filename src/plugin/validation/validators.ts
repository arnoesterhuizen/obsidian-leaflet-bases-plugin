import { LatLngTuple } from "leaflet";
import { IconName } from "obsidian";
import { Constants as C } from "@plugin/constants";
import { Coordinates, Hex, StringMap, Url, ValidatorFunction, Wiki } from "@plugin/types";

type ValidatedProperties = string | string[] | Wiki | number | boolean | undefined | LatLngTuple | StringMap;

function stringValidator(value: unknown): value is string {
	return typeof value === "string";
}

function sourcevalidator(value: unknown): value is string | Wiki {
	if (stringValidator(value)) return value.length > 0;
	if (Array.isArray(value) && Array.isArray(value[0]) && stringValidator(value[0][0]))
		return value[0][0].length > 0;
	return false;
}

function urlValidator(value: unknown): value is Url {
	return stringValidator(value) && C.regExp.url.test(value);
}

function numberValidator(value: unknown): value is number {
	return typeof value === "number" && isFinite(value) && !isNaN(value);
}

function positiveNumberValidator(value: unknown): value is number {
	return numberValidator(value) && value > 0;
}

function coordinatesValidator(value: unknown): value is Coordinates {
	return typeof value === "string" && C.regExp.coordinatesValidation.test(value);
}

function boundsValidator(value: unknown): value is string {
	return typeof value === "string" && C.regExp.boundsValidation.test(value);
}

function iconValidator(value: unknown): value is IconName {
	return typeof value === "string" && C.regExp.iconValidation.test(value);
}

function colorValidator(value: unknown): value is Hex {
	return typeof value === "string" && C.regExp.hexColorValidation.test(value);
}

function booleanValidator(value: unknown): value is boolean {
	return typeof value === "boolean";
}

function ignoreValidator(_value: unknown): _value is undefined {
	return true;
}

function latLngTupleValidator(value: unknown): value is LatLngTuple {
	return !!value && Array.isArray(value) && value.length === 2 && value.every(Validator.number);
}

function stringOrStringArrayValidator(value: unknown): value is string | string[] {
	if (typeof value === "string") return true;
	if (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === "string"))
		return true;
	return false;
}

function stringMapValidator(value: unknown): value is StringMap {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	return true;
}

export const Validator = {
	string: stringValidator,
	stringOrStringArray: stringOrStringArrayValidator,
	source: sourcevalidator,
	number: numberValidator,
	positiveNumber: positiveNumberValidator,
	coordinates: coordinatesValidator,
	bounds: boundsValidator,
	icon: iconValidator,
	color: colorValidator,
	boolean: booleanValidator,
	url: urlValidator,
	ignore: ignoreValidator,
	latLngTuple: latLngTupleValidator,
	stringMap: stringMapValidator,
} as const satisfies Record<string, ValidatorFunction<ValidatedProperties>>;
