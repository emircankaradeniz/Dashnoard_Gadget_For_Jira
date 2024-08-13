import Resolver from "@forge/resolver";
import api, { route } from "@forge/api";

const resolver = new Resolver();

export const fetchProjects = async () => {
  const response = await api
    .asApp()
    .requestJira(route`/rest/api/3/project/search`, {
      headers: {
        Accept: "application/json",
      },
    });

  if (!response.ok) {
    throw new Error(
      `Error fetching projects: ${response.status} ${response.statusText}`
    );
  }

  const projectsData = await response.json();
  console.log(projectsData.values);
  return projectsData.values;
};

resolver.define("fetchProjects", async (req) => {
  try {
    const projects = await fetchProjects();
    return projects;
  } catch (error) {
    console.error(error);
    throw new Error("Error fetching projects");
  }
});

export const handler = resolver.getDefinitions();