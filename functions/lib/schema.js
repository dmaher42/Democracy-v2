"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmissionSchema = void 0;
exports.parseSubmission = parseSubmission;
const zod_1 = require("zod");
const requiredTrimmedString = zod_1.z
    .string({ required_error: 'Value is required.' })
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, 'Value cannot be empty.');
function optionalString(value) {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
exports.SubmissionSchema = zod_1.z
    .object({
    studentName: requiredTrimmedString,
    assignmentId: requiredTrimmedString,
    content: zod_1.z.preprocess(optionalString, zod_1.z.string()).optional(),
    score: zod_1.z
        .preprocess((value) => {
        if (value === null || value === undefined || value === '') {
            return undefined;
        }
        if (typeof value === 'number') {
            return value;
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : undefined;
        }
        return undefined;
    }, zod_1.z.union([zod_1.z.number(), zod_1.z.string()]))
        .optional(),
    dedupeKey: zod_1.z.preprocess(optionalString, zod_1.z.string()).optional(),
})
    .strip();
function parseSubmission(data) {
    return exports.SubmissionSchema.parse(data);
}
