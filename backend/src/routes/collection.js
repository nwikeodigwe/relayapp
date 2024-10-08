const express = require("express");
const auth = require("../middleware/auth");
const { PrismaClient } = require("@prisma/client");
const router = express.Router();

const prisma = new PrismaClient();

router.post("/", [auth], async (req, res) => {
  let { name, description, tags } = req.body;

  if (!name || !description)
    return res.status(400).json({ error: "name and description is required" });

  if (tags && !Array.isArray(tags))
    return res.status(400).json({ error: "tags must be an array" });

  if (!!tags && tags.length > 0)
    tags = tags.map((tag) =>
      tag
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]/g, "")
    );

  const collection = await prisma.collection.create({
    data: {
      name,
      description,
      author: {
        connect: {
          id: req.user.id,
        },
      },
      ...(!!tags &&
        tags.length > 0 && {
          tags: {
            connectOrCreate: tags.map((tag) => ({
              where: { name: tag },
              create: { name: tag },
            })),
          },
        }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      tags: { select: { name: true } },
      author: {
        select: { name: true },
      },
      createdAt: true,
    },
  });

  res.status(201).json({ collection });
});

router.get("/", [auth], async (req, res) => {
  const collections = await prisma.collection.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      author: {
        select: { name: true },
      },
      tags: {
        select: { name: true },
      },
      _count: {
        select: { likedBy: true },
      },
    },
  });

  if (!collections)
    return res.status(404).json({ error: "No collection found" });

  res.status(200).json({ collections });
});

router.get("/:collection", [auth], async (req, res) => {
  const collection = await prisma.collection.findFirst({
    where: {
      id: req.params.collection,
    },
    select: {
      id: true,
      name: true,
      description: true,
      author: {
        select: { name: true },
      },
      tags: {
        select: { name: true },
      },
      _count: {
        select: { likedBy: true },
      },
    },
  });

  if (!collection)
    return res.status(404).json({ error: "Collection not found" });

  res.status(200).json({ collection });
});

router.get("/:collection/styles", [auth], async (req, res) => {
  const styles = await prisma.style.findMany({
    where: {
      collectionId: req.params.collection,
    },
    select: {
      id: true,
      name: true,
      description: true,
      published: true,
      tags: {
        select: { name: true },
      },
      _count: {
        select: { likedBy: true },
      },
      createdAt: true,
    },
  });

  if (!styles) return res.status(404).json({ error: "No style found" });

  res.status(200).json({ styles });
});

router.post("/:collection/like", [auth], async (req, res) => {
  const like = await prisma.likedCollection.create({
    data: {
      collection: { connect: { id: req.params.collection } },
      user: { connect: { id: req.user.id } },
    },
  });

  res.status(201).json({ like });
});

router.delete("/:collection/unlike", [auth], async (req, res) => {
  const like = await prisma.likedCollection.delete({
    where: {
      userId_collectionId: {
        userId: req.user.id,
        collectionId: req.params.collection,
      },
    },
  });

  if (!like) return res.status(404).json({ error: "Like not found" });

  res.status(204).end();
});

router.patch("/:collection", [auth], async (req, res) => {
  let { name, description, tags } = req.body;

  if (!!tags && !Array.isArray(tags))
    return res.status(400).json({ error: "tags must be an array" });

  if (!!tags && tags.length > 0)
    tags = tags.map((tag) =>
      tag
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]/g, "")
    );

  let collection = await prisma.collection.findFirst({
    where: { id: req.params.collection, authorId: req.user.id },
    select: { id: true },
  });

  if (!collection)
    return res.status(404).json({ error: "Collection not found" });

  name = name.trim() || collection.name;
  description = description.trim() || collection.description;
  tags = tags || collection.tags || [];

  collection = await prisma.collection.update({
    where: { id: req.params.collection, authorId: req.user.id },
    data: {
      name,
      description,
      ...(!!tags &&
        tags.length > 0 && {
          tags: {
            set: [],
            connectOrCreate: tags.map((tag) => ({
              where: { name: tag },
              create: { name: tag },
            })),
          },
        }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      tags: { select: { name: true } },
      author: {
        select: { name: true },
      },
      updatedAt: true,
    },
  });

  if (!collection)
    return res.status(404).json({ error: "Collection not found" });

  res.status(200).json({ collection });
});

router.delete("/:collection", [auth], async (req, res) => {
  const collection = await prisma.collection.delete({
    where: { id: req.params.collection, authorId: req.user.id },
  });

  if (!collection)
    return res.status(404).json({ error: "Collection not found" });

  res.status(204).end();
});

module.exports = router;
