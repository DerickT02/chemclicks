export default function LoginPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}>
      <form
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '300px',
        }}
      >
        <h2>Login Boilerplate</h2>

        {/* Mock sign-in page */}

        <input
          type="email"
          placeholder="Email"
          style={{ padding: '8px' }}
        />

        <input
          type="password"
          placeholder="Password"
          style={{ padding: '8px' }}
        />

        <button type="submit" style={{ padding: '8px', cursor: 'pointer' }}>
          Sign In
        </button>

        {/* Mock create account + forgot password links */}
        <span
            style={{
                color: 'blue',
                cursor: 'pointer',
                textDecoration: 'underline',
            }}
        >
        Create Account
        </span>

        <span
            style={{
                color: 'blue',
                cursor: 'pointer',
                textDecoration: 'underline',
            }}
        >
        Forgot password?
        </span>

      </form>
    </div>
  );
}