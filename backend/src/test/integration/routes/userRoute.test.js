const request = require("supertest");
const app = require("../../../app");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs/dist/bcrypt");
let server;

const prisma = new PrismaClient();

describe("User route", () => {
  let user;
  let user2;
  let token;
  let header;
  let passwordReset;

  const auth = async () => {
    const res = await request(server).post("/api/auth/signup").send(user);
    return res.body.token;
  };

  const createUser = () => {
    return prisma.user.create({
      data: {
        email: user2.email,
        password: bcrypt.hashSync(user.password, 10),
      },
    });
  };

  const createSubscription = () => {
    return prisma.userSubscription.create({
      data: {
        subscriber: {
          connect: { email: user.email },
        },
        user: { connect: { email: user2.email } },
      },
    });
  };

  beforeEach(async () => {
    server = app.listen(0, () => {
      server.address().port;
    });

    user = {
      email: "test@email.com",
      password: "password",
    };
    user2 = {
      email: "test2@email.com",
    };
    token = await auth();
    header = { authorization: `Bearer ${token}` };
  });

  afterEach(async () => {
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    await server.close();
  });

  describe("GET /", () => {
    it("Should return 404 if no user is found", async () => {
      const res = await request(server).get("/api/user").set(header);
      expect(res.status).toBe(404);
    });

    it("Should return 200 if token is valid", async () => {
      await createUser();
      const res = await request(server).get("/api/user").set(header);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /:user", () => {
    it("Should return 404 if user not found", async () => {
      const res = await request(server).get("/api/user/user").set(header);
      expect(res.status).toBe(404);
    });

    it("Should return 200 if user found", async () => {
      const res = await request(server)
        .get(`/api/user/${user.email}`)
        .set(header);
      expect(res.status).toBe(200);
    });
  });

  describe("POST /:user/subscribe", () => {
    it("Should return 404 if user not found", async () => {
      const res = await request(server)
        .post(`/api/user/cm431qxul0007hgi64pcv9mzz/subscribe`)
        .set(header);
      expect(res.status).toBe(404);
    });

    it("Should return 400 if already subscribed", async () => {
      const newUser = await createUser();
      await createSubscription();
      const res = await request(server)
        .post(`/api/user/${newUser.id}/subscribe`)
        .set(header);
      expect(res.status).toBe(400);
    });

    it("Should return 201 if subscription successful", async () => {
      const newUser = await createUser();
      const res = await request(server)
        .post(`/api/user/${newUser.id}/subscribe`)
        .set(header);
      expect(res.status).toBe(201);
    });
  });

  describe("DELETE /:user/unsubscribe", () => {
    it("Should return 404 if user not found", async () => {
      const res = await request(server)
        .delete(`/api/user/cm431qxul0007hgi64pcv9mzz/unsubscribe`)
        .set(header);
      expect(res.status).toBe(404);
    });

    it("Should return 400 if not subscribed", async () => {
      const newUser = await createUser();
      const res = await request(server)
        .delete(`/api/user/${newUser.id}/unsubscribe`)
        .set(header);
      expect(res.status).toBe(400);
    });

    it("Should return 200 if unsubscribed", async () => {
      const newUser = await createUser();
      await createSubscription();
      const res = await request(server)
        .delete(`/api/user/${newUser.id}/unsubscribe`)
        .set(header);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /me", () => {
    it("should return 500 if user not found", async () => {
      await prisma.user.deleteMany();
      const res = await request(server).get("/api/user/me").set(header);
      expect(res.status).toBe(500);
    });

    it("should return 200 if user exist", async () => {
      const res = await request(server).get("/api/user/me").set(header);
      expect(res.status).toBe(200);
    });
  });

  describe("PATCH /me", () => {
    it("should return 200 if data updated", async () => {
      const updateData = {
        name: "updatedname",
        email: "updatedemail@example.com",
      };
      const res = await request(server)
        .patch("/api/user/me")
        .set(header)
        .send(updateData);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("name", updateData.name);
      expect(res.body).toHaveProperty("email", updateData.email);
    });
  });

  describe("PATCH /profile", () => {
    it("Should return 200 if profile updated", async () => {
      const updatedProfile = {
        firstname: "firstname",
        lastname: "lastname",
        bio: "bio",
      };

      const res = await request(server)
        .patch("/api/user/profile")
        .set(header)
        .send(updatedProfile);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("firstname", updatedProfile.firstname);
      expect(res.body).toHaveProperty("lastname", updatedProfile.lastname);
      expect(res.body).toHaveProperty("bio", updatedProfile.bio);
    });
  });

  describe("PATCH /password", () => {
    beforeEach(() => {
      passwordReset = {
        password: user.password,
        newpassword: "newPassword",
      };
    });

    it("should return 400 if password is invalid", async () => {
      passwordReset.password = "wrongpassword";
      const res = await request(server)
        .patch("/api/user/password")
        .set(header)
        .send(passwordReset);

      expect(res.status).toBe(400);
    });

    it("Should return 200 if password is updated", async () => {
      const res = await request(server)
        .patch("/api/user/password")
        .set(header)
        .send(passwordReset);

      expect(res.status).toBe(200);
    });
  });
});