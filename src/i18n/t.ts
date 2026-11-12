import { en } from './messages/en';

export type MessageKey = keyof typeof en;

/** Union of the {placeholder} names in a message string. */
type ParamNames<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | ParamNames<Rest>
  : never;

type ParamsOf<K extends MessageKey> = ParamNames<(typeof en)[K]>;

type TArgs<K extends MessageKey> = [ParamsOf<K>] extends [never]
  ? []
  : [params: Record<ParamsOf<K>, string | number>];

/** Fills {name} placeholders. Unknown placeholders are left as written so gaps are visible. */
export function format(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Looks up a user-visible string. Works in server and client components.
 * A second locale will swap the catalogue here; call sites do not change.
 */
export function t<K extends MessageKey>(key: K, ...args: TArgs<K>): string {
  return format(en[key], args[0]);
}
