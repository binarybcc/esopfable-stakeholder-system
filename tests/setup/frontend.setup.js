import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { server } from '../mocks/server';

// Configure testing library
configure({ testIdAttribute: 'data-testid' });

// Mock environment variables
process.env.REACT_APP_API_URL = 'http://localhost:3001';
process.env.REACT_APP_AUTH0_DOMAIN = 'test-domain.auth0.com';
process.env.REACT_APP_AUTH0_CLIENT_ID = 'test-client-id';
process.env.REACT_APP_AUTH0_AUDIENCE = 'test-audience';

// Global DOM mocks
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock File and FileReader
global.File = class MockFile {
  constructor(parts, name, options = {}) {
    this.parts = parts;
    this.name = name;
    this.size = parts.reduce((size, part) => size + part.length, 0);
    this.type = options.type || '';
    this.lastModified = options.lastModified || Date.now();
  }
};

global.FileReader = class MockFileReader {
  constructor() {
    this.readyState = 0;
    this.result = null;
    this.error = null;
  }
  
  readAsText(file) {
    setTimeout(() => {
      this.readyState = 2;
      this.result = file.parts.join('');
      this.onload({ target: this });
    }, 0);
  }
  
  readAsDataURL(file) {
    setTimeout(() => {
      this.readyState = 2;
      this.result = `data:${file.type};base64,${btoa(file.parts.join(''))}`;
      this.onload({ target: this });
    }, 0);
  }
};

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = jest.fn();

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue(''),
  },
});

// Mock geolocation
Object.defineProperty(navigator, 'geolocation', {
  value: {
    getCurrentPosition: jest.fn((success) => 
      success({
        coords: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10
        }
      })
    ),
    watchPosition: jest.fn(),
    clearWatch: jest.fn()
  }
});

// Mock notifications
Object.defineProperty(window, 'Notification', {
  value: class MockNotification {
    constructor(title, options) {
      this.title = title;
      this.options = options;
    }
    
    static requestPermission() {
      return Promise.resolve('granted');
    }
  }
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
});

// Mock window.crypto
Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: {
      digest: jest.fn().mockResolvedValue(new ArrayBuffer(32))
    }
  }
});

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}));

// Mock canvas context
HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn().mockReturnValue({
    data: new Uint8ClampedArray(4)
  }),
  putImageData: jest.fn(),
  createImageData: jest.fn().mockReturnValue([]),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  measureText: jest.fn().mockReturnValue({ width: 10 }),
  fillText: jest.fn(),
  strokeText: jest.fn()
});

// Auth0 mock
jest.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    isLoading: false,
    isAuthenticated: true,
    user: {
      sub: 'auth0|test-user',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg'
    },
    loginWithRedirect: jest.fn(),
    logout: jest.fn(),
    getAccessTokenSilently: jest.fn().mockResolvedValue('mock-token'),
    getIdTokenClaims: jest.fn().mockResolvedValue({
      __raw: 'mock-raw-token'
    })
  }),
  Auth0Provider: ({ children }) => children,
  withAuthenticationRequired: (component) => component
}));

// React Query mock
jest.mock('react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
    getQueryData: jest.fn()
  })),
  QueryClient: jest.fn(),
  QueryClientProvider: ({ children }) => children,
  ReactQueryDevtools: () => null
}));

// React Router mock
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(() => jest.fn()),
  useLocation: jest.fn(() => ({
    pathname: '/test',
    search: '',
    hash: '',
    state: null
  })),
  useParams: jest.fn(() => ({})),
  useSearchParams: jest.fn(() => [new URLSearchParams(), jest.fn()])
}));

// Socket.IO client mock
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    connected: true
  }))
}));

// React DnD mock
jest.mock('react-dnd', () => ({
  useDrag: jest.fn(() => [{ isDragging: false }, jest.fn()]),
  useDrop: jest.fn(() => [{ isOver: false, canDrop: false }, jest.fn()]),
  DndProvider: ({ children }) => children
}));

jest.mock('react-dnd-html5-backend', () => ({
  HTML5Backend: 'HTML5Backend'
}));

// Framer Motion mock
jest.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
    form: 'form',
    input: 'input',
    span: 'span',
    p: 'p',
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    ul: 'ul',
    li: 'li'
  },
  AnimatePresence: ({ children }) => children,
  useAnimation: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    set: jest.fn()
  }))
}));

// Chart libraries mock
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: 'BarChart',
  LineChart: 'LineChart',
  PieChart: 'PieChart',
  XAxis: 'XAxis',
  YAxis: 'YAxis',
  CartesianGrid: 'CartesianGrid',
  Tooltip: 'Tooltip',
  Legend: 'Legend',
  Bar: 'Bar',
  Line: 'Line',
  Pie: 'Pie',
  Cell: 'Cell'
}));

// Test utilities
const createMockUser = (overrides = {}) => ({
  sub: 'auth0|test-user',
  email: 'test@example.com',
  name: 'Test User',
  picture: 'https://example.com/avatar.jpg',
  role: 'legal_team',
  permissions: ['read:documents', 'write:documents'],
  ...overrides
});

const createMockDocument = (overrides = {}) => ({
  id: 'doc-123',
  title: 'Test Document',
  description: 'Test document description',
  classification: 'internal',
  size: 1024,
  mimeType: 'application/pdf',
  uploadedBy: 'auth0|test-user',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

const createMockApiResponse = (data, success = true) => ({
  success,
  data,
  timestamp: new Date().toISOString(),
  ...(success ? {} : { error: { code: 'TEST_ERROR', message: 'Test error' } })
});

// Setup MSW server
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Cleanup between tests
afterEach(() => {
  localStorageMock.clear();
  sessionStorageMock.clear();
  jest.clearAllMocks();
});

// Export test utilities
global.frontendTestHelpers = {
  createMockUser,
  createMockDocument,
  createMockApiResponse
};

console.log('Frontend test setup completed');