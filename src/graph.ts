import * as d3 from "d3";
import { axisBottom, axisLeft } from "d3-axis";
import { LiveData } from "./main";

export default (totalFrames: number, data: LiveData[] | undefined) => {
  console.log(data, totalFrames);
  const svg = d3
    .select("#dataViz")
    .append("svg") // append the SVG to a div with the ID "app"
    .attr("width", 600) // adjust the size as needed
    .attr("height", 400);

  const xScale = d3
    .scaleLinear()
    .domain([0, totalFrames]) // your x values range from 0 to maxFrame
    .range([0, 600]); // adjust the size as needed

  const yScale = d3
    .scaleLinear()
    .domain([0, 30]) // your y values range from 0 to the max fps
    .range([400, 0]); // adjust the size as needed, note the range is flipped to account for SVG's coordinate system

  const xAxis = axisBottom(xScale);
  const yAxis = axisLeft(yScale);

  svg
    .append("g")
    .attr("transform", "translate(0,400)") // adjust the size as needed
    .call(xAxis);

  svg.append("g").call(yAxis);

  if (data?.length) {
    svg
      .selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", (d) => xScale(d.frame))
      .attr("y", (d) => yScale(d.fps))
      .attr("width", 5) // adjust as needed
      .attr("height", (d) => 400 - yScale(d.fps)); // adjust the size as needed
  }
};
