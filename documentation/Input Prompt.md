The product should visualize terraform environments, modules, and resources. I should be able to upload a main.tf file and it should parse out the various resource, data, input blocks (and any other blocks you come up with), and visualize them with react flow. I should also be able to see how everything is grouped by module so I can see cross-module interactions in an environment view. We want to have 3 levels: release pipeline view to see the connections between environments, environment view to see the connections between modules, and module view to see the resource and other connections inside the module. We want to be able to seemlessly switch between these different views. We also want to be able to easily modify the terraform code in a code editor and have the graph automatically update. We also want to be able to import and export projects with github.