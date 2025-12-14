import { prismaClient } from "./lib/prisma.js";

const CLOUDFRONT_URL = "https://d1vs1llhujzng9.cloudfront.net/";

export const getNextTask = async (userId: number) => {
  const task = await prismaClient.task.findFirst({
    where: {
      done: false,
      submissions: {
        none: {
          worker_id: userId,
        },
      },
    },
    select: {
      id: true,
      amount: true,
      title: true,
      options: {
        select: {
          id: true,
          image_url: true,
          task_id: true,
        },
      },
    },
  });

  if (task && task.amount) {
    // Transform image URLs to use CloudFront
    const transformedTask = {
      ...task,
      amount: task.amount.toString(),
      options: task.options.map(option => ({
        ...option,
        image_url: option.image_url.startsWith('http') 
          ? option.image_url 
          : `${CLOUDFRONT_URL}${option.image_url}`
      }))
    };
    return transformedTask;
  }
  return task;
};
