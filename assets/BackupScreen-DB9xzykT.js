import{c as s,j as e,M as h,s as u,S as y,t,U as b}from"./index-BUiWz0kK.js";/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=s("CalendarDays",[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}],["path",{d:"M8 14h.01",key:"6423bh"}],["path",{d:"M12 14h.01",key:"1etili"}],["path",{d:"M16 14h.01",key:"1gbofw"}],["path",{d:"M8 18h.01",key:"lrp35t"}],["path",{d:"M12 18h.01",key:"mhygvu"}],["path",{d:"M16 18h.01",key:"kzsmim"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=s("ClipboardCopy",[["rect",{width:"8",height:"4",x:"8",y:"2",rx:"1",ry:"1",key:"tgr4d6"}],["path",{d:"M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",key:"4jdomd"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v4",key:"3hqy98"}],["path",{d:"M21 14H11",key:"1bme5i"}],["path",{d:"m15 10-4 4 4 4",key:"5dvupr"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=s("Download",[["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["polyline",{points:"7 10 12 15 17 10",key:"2ggqvy"}],["line",{x1:"12",x2:"12",y1:"15",y2:"3",key:"1vk2je"}]]);/**
 * @license lucide-react v0.468.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=s("FileJson",[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1",key:"1oajmo"}],["path",{d:"M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1",key:"mpwhp6"}]]);function j(){const i=new Date().getMonth(),a=u[i];return e.jsxs("div",{className:"seasonal-reference",children:[e.jsxs("div",{className:"label-with-icon",children:[e.jsx(k,{size:20}),e.jsxs("strong",{children:["Ingrédients de saison en ",h[i]]})]}),e.jsx("p",{children:[...a.fruitsLegumes,...a.poissonsFruitsDeMer].join(", ")}),e.jsx("a",{href:y,children:"Source : Manger Bouger"})]})}const g=`Extract the recipe from this image and return only valid JSON for a Toquooking backup file.

Use this format:
{
  "version": 1,
  "exportedAt": "2026-07-19T00:00:00.000Z",
  "tags": [
    { "name": "Plat principal", "category": "Type" },
    { "name": "Rapide", "category": "Temps" }
  ],
  "recipes": [
    {
      "name": "",
      "tags": [],
      "origin": "",
      "servings": 4,
      "prepTime": 0,
      "restTime": 0,
      "cookTime": 0,
      "totalTime": 0,
      "ingredients": [
        { "name": "", "quantity": "", "unit": "", "note": "" }
      ],
      "instructions": [],
      "notes": "",
      "sourceUrl": "",
      "videoUrl": "",
      "imageUrl": "",
      "imageUrls": [],
      "sourceImageUrl": "",
      "sourceImageUrls": []
    }
  ]
}

Rules:
- Return JSON only, no markdown.
- Use minutes for prepTime, restTime, cookTime, and totalTime.
- Split ingredients into name, quantity, unit, and note.
- Keep instructions as clear ordered steps.
- If a value is missing or unreadable, leave it empty or omit it.
- Do not invent ingredients or steps.
- Leave image fields empty unless you have a real web image URL.
- Do not add id, createdAt, or updatedAt fields.`;function w({onExport:i,onImport:a,onDownloadExample:n,onDownloadDatabase:d,onStatus:o}){async function m(){try{await f(g),o(t("backup.status.aiPromptCopied"))}catch{o(t("backup.status.aiPromptCopyFailed"))}}return e.jsxs("section",{className:"panel workspace workspace--narrow",children:[e.jsx("div",{className:"section-heading",children:e.jsxs("div",{children:[e.jsx("span",{className:"eyebrow",children:t("backup.eyebrow")}),e.jsx("h2",{children:t("backup.title")})]})}),e.jsxs("div",{className:"backup-block",children:[e.jsxs("div",{className:"action-bar",children:[e.jsxs("button",{className:"button button--primary button--icon-mobile",onClick:i,children:[e.jsx(v,{size:18})," ",t("backup.action.exportAll")]}),e.jsxs("label",{className:"button file-button backup-import-button button--icon-mobile",children:[e.jsx(b,{size:18})," ",t("backup.action.import"),e.jsx("input",{accept:".zip,.txt,.json,application/zip,text/plain,application/json",onChange:r=>{var l;const c=(l=r.target.files)==null?void 0:l[0];c&&a(c),r.currentTarget.value=""},type:"file"})]})]}),e.jsx("p",{className:"muted",children:t("backup.help.files")})]}),e.jsxs("div",{className:"backup-block",children:[e.jsxs("div",{className:"action-bar",children:[e.jsxs("button",{className:"button button--icon-mobile",onClick:n,children:[e.jsx(p,{size:18})," ",t("backup.action.downloadExample")]}),e.jsxs("button",{className:"button button--icon-mobile",onClick:m,children:[e.jsx(x,{size:18})," ",t("backup.action.copyAiPrompt")]}),e.jsxs("button",{className:"button button--icon-mobile",onClick:d,children:[e.jsx(p,{size:18})," ",t("backup.action.downloadDatabase")]})]}),e.jsx("p",{className:"muted",children:t("backup.help.example")}),e.jsx("p",{className:"muted",children:t("backup.help.database")})]}),e.jsx(j,{})]})}async function f(i){var n;if((n=navigator.clipboard)!=null&&n.writeText)try{await navigator.clipboard.writeText(i);return}catch{}const a=document.createElement("textarea");a.value=i,a.setAttribute("readonly",""),a.style.position="fixed",a.style.left="-10000px",document.body.append(a),a.select();try{if(!document.execCommand("copy"))throw new Error("Copy failed")}finally{a.remove()}}export{w as BackupScreen};
