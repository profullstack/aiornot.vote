export type SubmissionFormRequest =
  | { ok: true; form: FormData }
  | { ok: false };

export async function readSubmissionForm(req: Request): Promise<SubmissionFormRequest> {
  try {
    return { ok: true, form: await req.formData() };
  } catch {
    return { ok: false };
  }
}
