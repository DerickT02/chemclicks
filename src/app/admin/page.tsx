export default function AdminPage() {
  return (
    <div style={{ padding: '40px', backgroundColor: '#0f1419', minHeight: '100vh', color: 'white' }}>
      <h1>Classrooms</h1>
      <p style={{ color: '#999', marginBottom: '30px' }}>
        Teacher admin view. Create classes, share classroom codes, and see where students are in the lesson.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left Panel - Your Classes */}
        <div style={{ backgroundColor: '#1a2332', padding: '20px', borderRadius: '8px' }}>
          <h2>Your classes</h2>
          <p style={{ color: '#666', marginTop: '20px' }}>Class list component goes here</p>
          
          <div style={{ marginTop: '40px' }}>
            <h3>Add a class</h3>
            <p style={{ color: '#666', marginTop: '20px' }}>Add class form component goes here</p>
          </div>
        </div>

        {/* Right Panel - Class Detail */}
        <div style={{ backgroundColor: '#1a2332', padding: '20px', borderRadius: '8px' }}>
          <h2>Chemistry Period 1</h2>
          <p style={{ color: '#666', marginTop: '20px' }}>Class detail component goes here</p>
          
          <div style={{ marginTop: '40px' }}>
            <h3>Active students</h3>
            <p style={{ color: '#666', marginTop: '20px' }}>Student list component goes here</p>
          </div>
        </div>
      </div>
    </div>
  );
}