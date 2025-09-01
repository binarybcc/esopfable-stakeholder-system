import React, { useState, useEffect } from 'react';

interface Stakeholder {
  id: string;
  category: string;
  subcategory?: string;
  name: string;
  organization: string;
  title: string;
  contactInfo: {
    phone: string;
    email: string;
    address: string;
  };
  metadata: any;
  securityLevel: 'standard' | 'restricted' | 'high';
  createdAt: string;
  updatedAt: string;
}

interface StakeholderResponse {
  success: boolean;
  data: Stakeholder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const StakeholderDashboard: React.FC = () => {
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [filteredStakeholders, setFilteredStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null);

  const categories = [
    { value: 'all', label: 'All Categories', color: '#6366f1' },
    { value: 'legal_team', label: 'Legal Team', color: '#10b981' },
    { value: 'government_entities', label: 'Government Entities', color: '#f59e0b' },
    { value: 'esop_participants', label: 'ESOP Participants', color: '#3b82f6' },
    { value: 'key_witnesses', label: 'Key Witnesses', color: '#ef4444' },
    { value: 'media_contacts', label: 'Media Contacts', color: '#8b5cf6' },
    { value: 'opposition', label: 'Opposition', color: '#ec4899' }
  ];

  const securityLevelColors = {
    standard: '#10b981',
    restricted: '#f59e0b', 
    high: '#ef4444'
  };

  useEffect(() => {
    fetchStakeholders();
  }, []);

  useEffect(() => {
    filterStakeholders();
  }, [stakeholders, selectedCategory, searchTerm]);

  const fetchStakeholders = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/stakeholders');
      const result: StakeholderResponse = await response.json();
      
      if (result.success) {
        setStakeholders(result.data);
        setError(null);
      } else {
        setError('Failed to fetch stakeholders');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const filterStakeholders = () => {
    let filtered = [...stakeholders];

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(s => s.category === selectedCategory);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(term) ||
        s.organization.toLowerCase().includes(term) ||
        s.title.toLowerCase().includes(term)
      );
    }

    setFilteredStakeholders(filtered);
  };

  const getCategoryInfo = (category: string) => {
    return categories.find(c => c.value === category) || categories[0];
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', padding: '20px', border: '2px solid #e5e7eb', borderRadius: '8px' }}>
          Loading stakeholders...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ padding: '20px', border: '2px solid #ef4444', borderRadius: '8px', color: '#ef4444' }}>
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      {/* Navigation Header */}
      <header style={{
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '1rem 2rem',
        marginBottom: '30px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button
              onClick={() => window.location.href = '/dashboard'}
              style={{
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              ← Back to Dashboard
            </button>
            <div>
              <span style={{ fontSize: '1.5rem', marginRight: '10px' }}>👥</span>
              <span style={{ fontSize: '1.5rem', color: '#1f2937', fontWeight: '600' }}>Stakeholder Management</span>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              window.location.href = '/';
            }}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <div style={{ padding: '0 30px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '30px' }}>
          <h1 style={{ margin: '0 0 10px 0', color: '#1f2937', fontSize: '2rem' }}>
            Case Stakeholders
          </h1>
          <p style={{ margin: '0', color: '#6b7280', fontSize: '1.1rem' }}>
            Manage and coordinate with all case stakeholders across different categories
          </p>
        </div>

      {/* Controls */}
      <div style={{ 
        display: 'flex', 
        gap: '20px', 
        marginBottom: '30px',
        padding: '20px',
        background: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#374151' }}>
            Category Filter
          </label>
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
        
        <div style={{ flex: 2 }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#374151' }}>
            Search Stakeholders
          </label>
          <input
            type="text"
            placeholder="Search by name, organization, or title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        {categories.slice(1).map(cat => {
          const count = stakeholders.filter(s => s.category === cat.value).length;
          return (
            <div 
              key={cat.value}
              style={{
                padding: '20px',
                background: 'white',
                border: `2px solid ${cat.color}20`,
                borderRadius: '8px',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: cat.color }}>
                {count}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '5px' }}>
                {cat.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stakeholder List */}
      <div style={{ 
        background: 'white', 
        border: '1px solid #e5e7eb', 
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <div style={{ 
          padding: '20px', 
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb'
        }}>
          <h2 style={{ margin: '0', color: '#1f2937' }}>
            Stakeholders ({filteredStakeholders.length})
          </h2>
        </div>

        {filteredStakeholders.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            No stakeholders found matching your criteria
          </div>
        ) : (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {filteredStakeholders.map(stakeholder => {
              const categoryInfo = getCategoryInfo(stakeholder.category);
              return (
                <div 
                  key={stakeholder.id}
                  onClick={() => setSelectedStakeholder(stakeholder)}
                  style={{
                    padding: '20px',
                    borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {/* Category & Security Indicator */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '120px' }}>
                    <div style={{
                      fontSize: '0.75rem',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: `${categoryInfo.color}20`,
                      color: categoryInfo.color,
                      textAlign: 'center',
                      fontWeight: '500'
                    }}>
                      {categoryInfo.label}
                    </div>
                    <div style={{
                      fontSize: '0.7rem',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      background: `${securityLevelColors[stakeholder.securityLevel]}20`,
                      color: securityLevelColors[stakeholder.securityLevel],
                      textAlign: 'center',
                      fontWeight: '500',
                      textTransform: 'uppercase'
                    }}>
                      {stakeholder.securityLevel}
                    </div>
                  </div>

                  {/* Main Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '1.1rem', color: '#1f2937', marginBottom: '5px' }}>
                      {stakeholder.name}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '3px' }}>
                      {stakeholder.title}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                      {stakeholder.organization}
                    </div>
                  </div>

                  {/* Contact Preview */}
                  <div style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'right', minWidth: '200px' }}>
                    <div>{stakeholder.contactInfo.email}</div>
                    <div>{stakeholder.contactInfo.phone}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stakeholder Detail Modal */}
      {selectedStakeholder && (
        <div style={{
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflowY: 'auto',
            width: '90%'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <h2 style={{ margin: '0', color: '#1f2937' }}>{selectedStakeholder.name}</h2>
              <button
                onClick={() => setSelectedStakeholder(null)}
                style={{
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                Close
              </button>
            </div>

            <div style={{ display: 'grid', gap: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 10px 0', color: '#374151' }}>Basic Information</h3>
                <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px' }}>
                  <p><strong>Title:</strong> {selectedStakeholder.title}</p>
                  <p><strong>Organization:</strong> {selectedStakeholder.organization}</p>
                  <p><strong>Category:</strong> {getCategoryInfo(selectedStakeholder.category).label}</p>
                  {selectedStakeholder.subcategory && (
                    <p><strong>Subcategory:</strong> {selectedStakeholder.subcategory}</p>
                  )}
                  <p><strong>Security Level:</strong> 
                    <span style={{
                      marginLeft: '8px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: `${securityLevelColors[selectedStakeholder.securityLevel]}20`,
                      color: securityLevelColors[selectedStakeholder.securityLevel],
                      fontSize: '0.8rem',
                      fontWeight: '500',
                      textTransform: 'uppercase'
                    }}>
                      {selectedStakeholder.securityLevel}
                    </span>
                  </p>
                </div>
              </div>

              <div>
                <h3 style={{ margin: '0 0 10px 0', color: '#374151' }}>Contact Information</h3>
                <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px' }}>
                  <p><strong>Email:</strong> {selectedStakeholder.contactInfo.email}</p>
                  <p><strong>Phone:</strong> {selectedStakeholder.contactInfo.phone}</p>
                  <p><strong>Address:</strong> {selectedStakeholder.contactInfo.address}</p>
                </div>
              </div>

              {selectedStakeholder.metadata && Object.keys(selectedStakeholder.metadata).length > 0 && (
                <div>
                  <h3 style={{ margin: '0 0 10px 0', color: '#374151' }}>Additional Details</h3>
                  <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px' }}>
                    {Object.entries(selectedStakeholder.metadata).map(([key, value]) => (
                      <p key={key}>
                        <strong>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong> {
                          typeof value === 'object' ? JSON.stringify(value) : String(value)
                        }
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default StakeholderDashboard;