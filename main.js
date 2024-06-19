const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const axiosRetry = require('axios-retry').default;
const { exponentialDelay } = require('axios-retry');
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

// Load environment variables from .env

const app = express();
const port = 3001;

const server = http.createServer(app);

app.use(bodyParser.json());
app.use(cors());

axiosRetry(axios, { retries: 5, retryDelay: exponentialDelay }); // Retry on network errors


app.post('/trigger-workflow', async (req, res) => {
  const { imageName, repoUrl, desiredDirectory } = req.body;
  const token = process.env.TOKEN;
  const owner = process.env.OWNER;
  const repo = process.env.REPO;
  const workflow_id = process.env.WORKFLOW_ID;
  let latestId=0;

  try {
    // Trigger the workflow
    await axios.post(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`, {
      ref: 'main', // Assuming you're triggering the workflow on the main branch
      inputs: {
        image_name: imageName,
        repo_url: repoUrl,
        desired_directory: desiredDirectory
      }
    }, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    console.log('GitHub Action triggered successfully!');

    // Delay for 5 seconds before fetching the latest workflow run ID
    setTimeout(async () => {
      try {
        // Query the workflow runs to find the latest one triggered by your action
        const workflowRunsResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/actions/runs`, {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          params: {
            branch: 'main', // Filter by branch name
            per_page: 1,
            page: 1
          }
        });

        // Extract the ID of the latest workflow run
        const latestWorkflowRunId = workflowRunsResponse.data.workflow_runs[0].id;
        console.log('Latest workflow run ID:', latestWorkflowRunId);
        latestId=latestWorkflowRunId;
      } catch (error) {
        console.error('Error fetching latest workflow run:', error.response ? error.response.data : error.message);
      }
    }, 5000); // 5000 milliseconds = 5 seconds

    res.json({ message: 'GitHub Action triggered successfully!',latestWorkflowRunId:latestId });
  } catch (error) {
    console.error('Error triggering GitHub Action:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to trigger GitHub Action.' });
  }
});




app.get('/latest-workflow-id', async (req, res) => {
  const token = process.env.TOKEN;
  const owner = process.env.OWNER;
  const repo = process.env.REPO;
  const workflow_id = process.env.WORKFLOW_ID;
  try {
    const workflowRunsResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/actions/runs`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      params: {
        branch: 'main',
        per_page: 1,
        page: 1
      }
    });

    const latestWorkflowRunId = workflowRunsResponse.data.workflow_runs[0].id;
    res.json({ workflowId: latestWorkflowRunId });
  } catch (error) {
    console.error('Error fetching latest workflow ID:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to fetch latest workflow ID.' });
  }
});

app.get('/workflow-status', async (req, res) => {
  const runId = req.query.run_id;
  const token = process.env.TOKEN;
  const owner = process.env.OWNER;
  const repo = process.env.REPO;

  try {
    const response = await axios({
      method: 'get',
      url: `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`,
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    res.json(response.data);
    console.log('Workflow status fetched:', response.data);
  } catch (error) {
    console.error('Error fetching workflow status:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to fetch workflow status.' });
  }
});


server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});