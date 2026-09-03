import type { ReactNode } from "react"
import { newId } from "../cms/clone"
import type { MediaRef } from "../cms/types"

type FieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
}

export function Field({ label, value, onChange, multiline }: FieldProps) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {multiline ? (
        <textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}

export function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="admin-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export function MediaFields({
  label,
  image,
  onChange,
}: {
  label: string
  image: MediaRef
  onChange: (image: MediaRef) => void
}) {
  return (
    <div className="admin-media">
      <Field label={`${label}路径`} value={image.src} onChange={(src) => onChange({ ...image, src })} />
      <Field label={`${label}说明`} value={image.alt} onChange={(alt) => onChange({ ...image, alt })} />
    </div>
  )
}

export function StringList({
  label,
  items,
  onChange,
}: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
}) {
  return (
    <fieldset className="admin-list">
      <legend>{label}</legend>
      {items.map((item, index) => (
        <div className="admin-list__row" key={`${label}-${index}`}>
          <input
            value={item}
            onChange={(e) => {
              const next = [...items]
              next[index] = e.target.value
              onChange(next)
            }}
          />
          <button type="button" onClick={() => onChange(items.filter((_, i) => i !== index))}>
            删除
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ""])}>
        新增一条
      </button>
    </fieldset>
  )
}

export function BlockList<T extends { id: string }>({
  label,
  items,
  onChange,
  blank,
  children,
}: {
  label: string
  items: T[]
  onChange: (items: T[]) => void
  blank: () => Omit<T, "id">
  children: (item: T, update: (patch: Partial<T>) => void) => ReactNode
}) {
  return (
    <fieldset className="admin-list">
      <legend>{label}</legend>
      {items.map((item, index) => (
        <div className="admin-card" key={item.id}>
          {children(item, (patch) => {
            const next = [...items]
            next[index] = { ...item, ...patch }
            onChange(next)
          })}
          <div className="admin-card__actions">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => {
                const next = [...items]
                const [row] = next.splice(index, 1)
                next.splice(index - 1, 0, row)
                onChange(next)
              }}
            >
              上移
            </button>
            <button
              type="button"
              disabled={index === items.length - 1}
              onClick={() => {
                const next = [...items]
                const [row] = next.splice(index, 1)
                next.splice(index + 1, 0, row)
                onChange(next)
              }}
            >
              下移
            </button>
            <button type="button" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}>
              删除此项
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { id: newId("item"), ...blank() } as T])}>
        新增一项
      </button>
    </fieldset>
  )
}
