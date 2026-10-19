import { createTextWritingModule } from "../text-writing/create-module";
import { generateDonorSlug } from "./donor";

const module = createTextWritingModule((input) => generateDonorSlug(input));
export default module;
