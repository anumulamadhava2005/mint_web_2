import { renderJSX } from "./lib/convert/core/render";

const node = {
  id: "list-1",
  type: "FRAME",
  name: "TodoList",
  w: 100, h: 100,
  ux: { scrollY: true },
  bindings: {
    repeatFor: "$todos",
    repeatAs: "todo"
  },
  children: [
    {
      id: "text-1",
      type: "TEXT",
      name: "TodoText",
      text: { characters: "Task Text Here" },
      bindings: {
        textBind: "todo.task"
      }
    }
  ]
};

const options = {
  indent: 6,
  useTypescript: true,
  includeDataAttributes: true
};

const output = renderJSX([node as any], options);
console.log(output);
