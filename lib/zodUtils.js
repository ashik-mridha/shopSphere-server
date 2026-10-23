import { z } from "zod";

/** Partial schema for PATCH routes with zod defaults removed, so omitted fields stay untouched. */
export function patchSchema(schema) {
    const shape = Object.fromEntries(
        Object.entries(schema.shape).map(([key, field]) => [key, field.def?.type === "default" ? field.def.innerType : field])
    );
    return z.object(shape).partial();
}
