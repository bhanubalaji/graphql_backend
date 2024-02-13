// Import required modules
const express = require('express');
const { ApolloServer, gql } = require('apollo-server-express');
const app = express();
const { PubSub } = require('graphql-subscriptions');
const pubsub = new PubSub();
const { SubscriptionServer } = require('subscriptions-transport-ws')
const { execute, subscribe } = require('graphql');
const http = require('http');
const { createServer } = require('http');

const typeDefs = gql`
  type Post {
    id: ID!
    title: String!
    content: String!
    author: String!
  }

  type Rate {
    currency: String
    rate: Float
  }

  type Query {
    posts: [Post!]!
    post(id: ID!): Post
    rates(currency: String!): [Rate]
  }
  input PostInput {
    title: String!
    content: String!
    author: String!
  }

  type Mutation {
    createPost(input: PostInput!): Post
    deletePost(id: ID!): Boolean

  }

  type Subscription {
    postAdded: Post
  }
`;

// Sample posts data
var posts = [
  { id: '1', title: 'Post 1', content: 'Content 1', author: 'Author 1' },
  { id: '2', title: 'Post 2', content: 'Content 2', author: 'Author 2' }
];

// Sample rates data
const ratesData = [
  { currency: 'USD', rate: 1.0 },
  { currency: 'EUR', rate: 0.85 },
  { currency: 'GBP', rate: 0.73 }
];

// Define resolvers
const resolvers = {
  Query: {
    post: (_, { id }) => posts.find(post => post.id === id),
    rates: (_, { currency }) => {
      if (currency) {
        return ratesData.filter(rate => rate.currency === currency);
      }
      return ratesData;
    },
    posts: () => posts,
  },
  Mutation: {
    createPost: (_, { input }) => {
      const newPost = { id: String(posts.length + 1), ...input };
      posts.push(newPost);
      pubsub.publish('POST_ADDED', { postAdded: newPost });
      // console.log(pubsub)
      return newPost;
    },
    deletePost: (_, { id }) => {
      const index = posts.findIndex(post => post.id === id);
      if (index !== -1) {
        posts.splice(index, 1);
        return true; // Post deleted successfully
      }
      return false; // Post with the given ID not found
    }
  },
  Subscription: {
    postAdded: {
      subscribe: () => pubsub.asyncIterator(['POST_ADDED']),
    },
  },
};

const server = new ApolloServer({ typeDefs, resolvers });

// Start the server asynchronously
async function startServer() {
  await server.start();

  // Apply middleware to Express app
  server.applyMiddleware({ app });

  // Create HTTP server
  const httpServer = createServer(app);

  // Install Subscription handlers
  SubscriptionServer.create(
    {
      schema: server.schema,
      execute,
      subscribe,
    },
    {
      server: httpServer,
      path: server.graphqlPath,
    }
  );

  // Start the HTTP server
  const PORT = process.env.PORT || 4202;
  httpServer.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`Subscriptions ready at ws://localhost:${PORT}${server.graphqlPath}`);
  });
}

// Call the function to start the server
startServer().catch(error => {
  console.error('Error starting server:', error);
});


