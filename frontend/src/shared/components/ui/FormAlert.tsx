export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="form-alert">
      {message}
    </div>
  )
}
