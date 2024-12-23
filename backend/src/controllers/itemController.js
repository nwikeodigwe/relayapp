const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.createItem = async (req, res) => {
  let { name, description, brand, images, creator, tags } = req.body;

  if (!name || !description)
    return res
      .status(400)
      .json({ message: "Name and description is required" });

  if (!Array.isArray(images) || images.length === 0)
    return res.status(400).json({ message: "At least one image is required" });

  if (tags && !Array.isArray(tags))
    return res.status(400).json({ message: "Tags must be an array" });

  if (tags && tags.length > 0)
    tags = tags.map((tag) =>
      tag
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]/g, "")
    );

  if (!brand) return res.status(400).json({ message: "Brand is required" });

  brand = brand
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]/g, "");

  creator = await prisma.user.findFirst({
    where: {
      OR: [{ id: creator }, { name: creator }, { email: creator }],
    },
    select: {
      id: true,
    },
  });

  creator ? (creator = creator.id) : (creator = req.user.id);

  const item = await prisma.item.create({
    data: {
      name,
      description,
      brand: {
        connectOrCreate: {
          where: { name: brand },
          create: { name: brand },
        },
      },
      images: {
        connect: images.map((image) => ({
          id: image,
        })),
      },
      ...(tags &&
        tags.length > 0 && {
          tags: {
            connectOrCreate: tags.map((tag) => ({
              where: { name: tag },
              create: { name: tag },
            })),
          },
        }),
      creator: {
        connect: {
          id: creator,
        },
      },
    },
    include: {
      tags: { select: { name: true } },
      images: { select: { url: true } },
      brand: { select: { name: true } },
    },
  });

  res.status(201).json({ item });
};

exports.getItem = async (req, res) => {
  const items = await prisma.item.findMany({
    //where: {
    // Should fix
    //   published: true,
    //},
    select: {
      id: true,
      name: true,
      description: true,
      images: { select: { url: true } },
      tags: { select: { name: true } },
      brand: { select: { name: true } },
      creator: { select: { name: true } },
      // Should fix
      // _count: {
      //   select: {
      //     likedBy: true,
      //   },
      // },
      createdAt: true,
    },
  });

  if (!items.length) return res.status(404).json({ message: "No item found" });

  res.status(200).json({ items });
};

exports.getItemById = async (req, res) => {
  const item = await prisma.item.findUnique({
    where: {
      id: req.params.item,
    },
    select: {
      id: true,
      name: true,
      description: true,
      images: { select: { url: true } },
      tags: { select: { name: true } },
      brand: { select: { name: true } },
      styles: true,
      // Should fix
      // _count: {
      //   select: {
      //     likedBy: true,
      //   },
      // },
      createdAt: true,
    },
  });

  if (!item) return res.status(404).json({ message: "Item not found" });

  res.status(200).json({ item });
};

exports.favoriteItem = async (req, res) => {
  const item = await prisma.item.findFirst({
    where: {
      id: req.params.item,
    },
    select: {
      id: true,
    },
  });

  if (!item) return res.status(404).json({ message: "item not found" });

  const favorite = await prisma.favoriteItem.upsert({
    where: {
      userId_itemId: {
        userId: req.user.id,
        itemId: item.id,
      },
    },
    create: {
      user: {
        connect: {
          id: req.user.id,
        },
      },
      item: {
        connect: {
          id: req.params.item,
        },
      },
    },
    update: {},
    select: {
      id: true,
    },
  });

  res.status(201).json({ favorite });
};

exports.unfavoriteItem = async (req, res) => {
  const item = await prisma.item.findFirst({
    where: {
      id: req.params.item,
    },
  });

  if (!item) return res.status(404).json({ message: "item not found" });

  let favorite = await prisma.favoriteItem.findFirst({
    where: {
      userId: req.user.id,
      itemId: item.id,
    },
  });

  if (!favorite)
    return res.status(400).json({ message: "item is not favorited" });

  await prisma.favoriteItem.delete({
    where: {
      userId_itemId: {
        userId: favorite.userId,
        itemId: favorite.itemId,
      },
    },
  });

  res.status(204).end();
};

exports.upvoteItem = async (req, res) => {
  const item = await prisma.item.findFirst({
    where: {
      id: req.params.item,
    },
  });

  if (!item) return res.status(404).json({ message: "Item not found" });

  const upvote = await prisma.itemVote.upsert({
    where: {
      userId_itemId: { itemId: req.params.item, userId: req.user.id },
    },
    update: {
      vote: 1,
    },
    create: {
      user: {
        connect: {
          id: req.user.id,
        },
      },
      item: {
        connect: {
          id: req.params.item,
        },
      },
      vote: 1,
    },
  });

  res.status(200).json({ upvote });
};

exports.downvoteItem = async (req, res) => {
  const item = await prisma.item.findFirst({
    where: {
      id: req.params.item,
    },
  });

  if (!item) return res.status(404).json({ message: "Item not found" });

  const downvote = await prisma.itemVote.upsert({
    where: {
      userId_itemId: { itemId: req.params.item, userId: req.user.id },
    },
    update: {
      vote: -1,
    },
    create: {
      user: {
        connect: {
          id: req.user.id,
        },
      },
      item: {
        connect: {
          id: req.params.item,
        },
      },
      vote: -1,
    },
  });

  res.status(200).json({ downvote });
};

exports.unvoteItem = async (req, res) => {
  const item = await prisma.item.findFirst({
    where: {
      id: req.params.item,
    },
  });

  if (!item) return res.status(404).json({ message: "Item not found" });

  await prisma.itemVote.delete({
    where: {
      userId_itemId: { itemId: req.params.item, userId: req.user.id },
    },
  });

  res.status(204).end();
};

exports.updateItem = async (req, res) => {
  let { name, description, images, tags, creator } = req.body;

  if (images && (!Array.isArray(images) || images.length === 0))
    return res.status(400).json({ message: "At least one image is required" });

  if (tags && !Array.isArray(tags))
    return res.status(400).json({ message: "Tags must be an array" });

  if (!!tags && tags.length > 0)
    tags = tags.map((tag) =>
      tag
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]/g, "")
    );

  let item = await prisma.item.findFirst({
    where: {
      id: req.params.id,
    },
    select: {
      name: true,
      description: true,
      images: true,
      creator: true,
    },
  });

  if (!item) return res.status(404).json({ message: "Item not found" });

  // if (creator) {
  //   creator = await prisma.user.findFirst({
  //     where: { OR: [{ id: creator }, { name: creator }, { email: creator }] },
  //     select: { id: true },
  //   });
  //   creator = creator.id || undefined;
  // }

  name = name || item.name;
  description = description || item.description;
  images = images || item.images;
  creator = creator || item.creator.id;

  item = await prisma.item.update({
    where: {
      id: req.params.item,
      creator: { id: req.user.id },
    },
    data: {
      name,
      description,
      //Should fix
      // images: {
      //   deleteMany: {},
      //   connect: images.map((image) => ({
      //     id: image,
      //   })),
      // },
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
      ...(creator && {
        creator: {
          connect: {
            id: creator,
          },
        },
      }),
    },
    include: {
      images: { select: { url: true } },
      tags: { select: { name: true } },
      brand: { select: { name: true } },
    },
  });

  res.status(200).json({ item });
};

exports.deleteItem = async (req, res) => {
  let item = await prisma.item.findFirst({
    where: {
      id: req.params.item,
      creator: { id: req.user.id },
    },
  });

  if (!item) return res.status(404).json({ message: "Item not found" });

  await prisma.item.delete({
    where: {
      id: item.id,
    },
  });

  res.status(204).end();
};
