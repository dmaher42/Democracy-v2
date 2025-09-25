import { z } from 'zod';

const requiredTrimmedString = z
  .string({ required_error: 'Value is required.' })
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, 'Value cannot be empty.');

function optionalString(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const SubmissionSchema = z
  .object({
    studentName: requiredTrimmedString,
    assignmentId: requiredTrimmedString,
    content: z.preprocess(optionalString, z.string()).optional(),
    score: z
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
      }, z.union([z.number(), z.string()]))
      .optional(),
    dedupeKey: z.preprocess(optionalString, z.string()).optional(),
  })
  .strip();

export type Submission = z.infer<typeof SubmissionSchema>;

export function parseSubmission(data: unknown): Submission {
  return SubmissionSchema.parse(data);
}
