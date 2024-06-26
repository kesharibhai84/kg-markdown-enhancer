"use client"
import React, { useEffect, useState } from 'react';
import { marked } from 'marked';
import neo4j from 'neo4j-driver';
import readNodes from '@/Utils/ReadNodes';

const Neo4jPage = () => {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viz, setViz] = useState(null);
  const defaultMarkdown = `
Marked - Markdown Parser
========================

[Marked] lets you convert [Markdown] into HTML.  Markdown is a simple text format whose goal is to be very easy to read and write, even when not converted to HTML.  This demo page will let you type anything you like and see how it gets converted.  Live.  No more waiting around.

How To Use The Demo
-------------------

1. Type in stuff on the left.
2. See the live updates on the right.

That's it.  Pretty simple.  There's also a drop-down option above to switch between various views:

- **Preview:**  A live display of the generated HTML as it would render in a browser.
- **HTML Source:**  The generated HTML before your browser makes it pretty.
- **Lexer Data:**  What [marked] uses internally, in case you like gory stuff like this.
- **Quick Reference:**  A brief run-down of how to format things using markdown.

*Why Markdown?*
-------------

It's easy.  It's not overly bloated, unlike HTML.  Also, as the creator of [markdown] says,

- > The overriding design goal for Markdown's
- > formatting syntax is to make it as readable
- > as possible. The idea is that a
- > Markdown-formatted document should be
- > publishable as-is, as plain text, without
- > looking like it's been marked up with tags
- > or formatting instructions.

Ready to start writing?  Either start changing stuff on the left or
[clear everything](/demo/?text=) with a simple click.

`;
  const uri = 'bolt://localhost:7687';
  const user = 'neo4j';
  const password = 'testingInstance';
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  
  const [database, setDatabase] = useState([]);
  const [markdown] = useState(defaultMarkdown);

  useEffect(()=>{
    async function fetchNodeNames() {
      const session = driver.session();

      try {
        const result = await session.run("MATCH (n) RETURN collect(n.name) AS nodeNames");
        const nodeNames = result.records[0].get('nodeNames');
        setDatabase(nodeNames);
      } catch (error) {
        console.error('Error fetching node names:', error);
      } finally {
        await session.close();
      }
    }
    fetchNodeNames();
  },[]) 
  const highlightWords = (text) => {
    return text.replace(/\b(\w+)\b/g, (word) => {
      if (database.includes(word)) {
        return `<button onclick="handleWordClick('${word}')" style="background-color: yellow; cursor:pointer">${word}</button>`;
      } else {
        return word;
      }
    });
  };
  

  const html = marked.parse(markdown);
  const highlightedHtml = highlightWords(html);


  useEffect(() => {
    async function fetchData() {
      try {
        const data = await readNodes();
        setNodes(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching nodes:', error);
        setLoading(false);
      }
    }
    fetchData();
    const session = driver.session();
    subscribeToChanges();
    return () => {
      if (session) {
        session.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!loading && nodes.length > 0) {
      if (viz) {
        viz.render(); // Call render method when viz is available
      }
    }
  }, [loading, nodes, viz]);

  useEffect(() => {
    if (!loading && nodes.length > 0) {
      renderVisualization(nodes);
    }
  }, [loading, nodes]);

  async function subscribeToChanges() {
    try {
      const session = driver.session();
      await session.run('MATCH (n) RETURN n', {
        onNext: async (record) => {
          const data = await readNodes();
          setNodes(data);
        },
        onError: (error) => {
          console.error('Subscription error:', error);
        },
      });
    } catch (error) {
      console.error('Error subscribing to changes:', error);
    }
  }

  async function renderVisualization(data) {
    try {
      const cypher = `MATCH (n:Word)
      OPTIONAL MATCH (n)-[r:VERB]->(m:Word)
      RETURN n, r, m`;
      ;
      const NeoVis = await import('neovis.js/dist/neovis.js'); // Dynamically import NeoVis
      const config = {
        containerId: 'viz',
        neo4j: {
          serverUrl: 'bolt://localhost:7687',
          serverUser: 'neo4j',
          serverPassword: 'testingInstance',
        },
        labels: {
          "Word": {
            label: 'name',
            size: 'age',
          },
        },
        relationships: {
          "VERB": {
            thickness: 2,
          },
        },
        initialCypher: cypher,
        clickNodes: handleWordClick, // Add clickNodes callback
      };

      const viz = new NeoVis.default(config);
      setViz(viz); // Set viz object in state
    } catch (error) {
      console.error('Error rendering visualization:', error);
    }
  }
  useEffect(()=>{
    if(typeof window!==undefined){
      window.handleWordClick = async (word) => {
        if (viz) {
          viz.clearNetwork(); 
        }
        try {
          const cypher = `
            MATCH (n {name: '${word}'})-[r]-(m)
            RETURN n, r, m
          `;
          const NeoVis = await import('neovis.js/dist/neovis.js'); 
          const config = {
            containerId: "viz",
            neo4j: {
              serverUrl: "bolt://localhost:7687",
              serverUser: "neo4j",
              serverPassword: "testingInstance",
            },
            labels:{
              "Word":{
                label:"name",
                size:"age",
              }
            },
            relationships: {
              "VERB": {
                thickness: 2,
              },
            },
            initialCypher: cypher,
      
          }
          const subViz = new NeoVis.default(config);
          subViz.render();
        } catch (error) {
          console.error('Error rendering sub-graph:', error);
        }
      };
        
    }
    
  },[])

  // Function to fetch data related to the clicked word from Neo4j

  return (
    <div style={{ display: 'flex' }}>
  <div style={{ width: '50%', height: '100vh', overflowY: 'auto' }}>
    <h1>Neo4j Visualization</h1>
    {loading ? (
      <p>Loading...</p>
    ) : (
      <div id="viz" style={{ width: '100%', height: '80%' }}></div>
    )}
  </div>
  <div style={{ width: '50%', height: '100vh', overflowY: 'auto' }}>
    <h1>Markdown Content</h1>
    <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
  </div>
</div>

  );
}; 
export default Neo4jPage;

