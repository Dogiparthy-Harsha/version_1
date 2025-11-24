#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting AI Shopping Assistant...${NC}"
echo "================================"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${RED}❌ Virtual environment not found!${NC}"
    echo "Please run: python3 -m venv venv"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Please create a .env file with your API keys"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Frontend dependencies not installed${NC}"
    echo "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
fi

# Activate virtual environment
echo -e "${GREEN}✓ Activating virtual environment${NC}"
source venv/bin/activate

# Create log directory
mkdir -p logs

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down all services...${NC}"
    
    # Kill all background processes
    if [ ! -z "$MCP_PID" ]; then
        echo "Stopping MCP servers..."
        kill $MCP_PID 2>/dev/null
        pkill -f 'mcp_servers' 2>/dev/null
    fi
    
    if [ ! -z "$API_PID" ]; then
        echo "Stopping API server..."
        kill $API_PID 2>/dev/null
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        echo "Stopping frontend..."
        kill $FRONTEND_PID 2>/dev/null
    fi
    
    echo -e "${GREEN}✓ All services stopped${NC}"
    exit 0
}

# Set up trap to catch Ctrl+C and other termination signals
trap cleanup SIGINT SIGTERM EXIT

# Start MCP Servers
echo -e "${BLUE}📡 Starting MCP Servers...${NC}"
./start_mcp_servers.sh > logs/mcp_servers.log 2>&1 &
MCP_PID=$!
sleep 3  # Wait for MCP servers to initialize

# Check if MCP servers started successfully
if ! pgrep -f "mcp_servers" > /dev/null; then
    echo -e "${RED}❌ Failed to start MCP servers${NC}"
    echo "Check logs/mcp_servers.log for details"
    exit 1
fi
echo -e "${GREEN}✓ MCP Servers running (PID: $MCP_PID)${NC}"

# Start Backend API
echo -e "${BLUE}🔧 Starting Backend API...${NC}"
python3 api_mcp.py > logs/api.log 2>&1 &
API_PID=$!
sleep 2  # Wait for API to initialize

# Check if API started successfully
if ! ps -p $API_PID > /dev/null; then
    echo -e "${RED}❌ Failed to start API server${NC}"
    echo "Check logs/api.log for details"
    exit 1
fi
echo -e "${GREEN}✓ Backend API running on http://127.0.0.1:8000 (PID: $API_PID)${NC}"

# Start Frontend
echo -e "${BLUE}⚛️  Starting Frontend...${NC}"
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
sleep 3  # Wait for frontend to initialize

# Check if frontend started successfully
if ! ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${RED}❌ Failed to start frontend${NC}"
    echo "Check logs/frontend.log for details"
    exit 1
fi
echo -e "${GREEN}✓ Frontend running on http://localhost:5173 (PID: $FRONTEND_PID)${NC}"

echo ""
echo "================================"
echo -e "${GREEN}✅ All services started successfully!${NC}"
echo "================================"
echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
echo "  • MCP Servers:  http://127.0.0.1:8001-8003"
echo "  • Backend API:  http://127.0.0.1:8000"
echo "  • Frontend:     http://localhost:5173"
echo ""
echo -e "${BLUE}📝 Logs:${NC}"
echo "  • MCP Servers:  logs/mcp_servers.log"
echo "  • Backend API:  logs/api.log"
echo "  • Frontend:     logs/frontend.log"
echo ""
echo -e "${YELLOW}💡 Tip: View logs in real-time with:${NC}"
echo "  tail -f logs/api.log"
echo ""
echo -e "${BLUE}🌐 Open your browser to: http://localhost:5173${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for user to press Ctrl+C
wait
