import { forwardRef } from 'react';
import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

// Form-field primitives over the `.input` / `.label` CSS component classes in
// `index.css`. Each emits `class="<base> [className]"` — base class first,
// extra `className` appended verbatim — so the rendered markup is
// byte-identical to the raw `className="input …"` call sites it replaces.
// All four forward their ref to the underlying element.

/** Props for {@link Input}. All native `<input>` props pass through. */
export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** Text input styled with the `.input` component class. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={className ? `input ${className}` : 'input'} {...rest} />;
});

/** Props for {@link Select}. All native `<select>` props pass through. */
export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** Select styled with the `.input` component class (pages style selects with `.input`). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={className ? `input ${className}` : 'input'} {...rest} />;
});

/** Props for {@link Textarea}. All native `<textarea>` props pass through. */
export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Textarea styled with the `.input` component class. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={className ? `input ${className}` : 'input'} {...rest} />;
});

/** Props for {@link Label}. All native `<label>` props pass through. */
export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

/** Form label styled with the `.label` component class. */
export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label({ className, ...rest }, ref) {
  return <label ref={ref} className={className ? `label ${className}` : 'label'} {...rest} />;
});
