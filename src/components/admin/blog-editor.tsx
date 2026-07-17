import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { supabase } from '../../lib/supabase';
import { renderWithLinks } from '../../lib/render-inline-links';

interface Block {
  type: 'p' | 'h2' | 'h3' | 'callout' | 'stat' | 'list' | 'image' | 'box' | 'button';
  content: string;
  value?: string; 
  items?: string[];
}

export function BlogEditor({ postId, onSaved }: { postId?: string; onSaved?: () => void }) {
  // Estados generales
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  
  // SEO
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');

  // Imágenes
  const [imageHero, setImageHero] = useState('');
  const [imageThumbnail, setImageThumbnail] = useState('');
  const [imageOg, setImageOg] = useState('');
  const [imageInline, setImageInline] = useState('');
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  
  // Banner Override MID
  const [customBannerMidSrc, setCustomBannerMidSrc] = useState('');
  const [customBannerMidHref, setCustomBannerMidHref] = useState('');
  
  // Banner Override FINAL
  const [customBannerFinalSrc, setCustomBannerFinalSrc] = useState('');
  const [customBannerFinalHref, setCustomBannerFinalHref] = useState('');
  
  // Estado de los bloques
  const [blocks, setBlocks] = useState<Block[]>([{ type: 'p', content: '' }]);
  const [status, setStatus] = useState('draft');
  const [loading, setLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Estado para almacenar las categorías únicas existentes
  const [existingCategories, setExistingCategories] = useState<string[]>([]);

  // Cargar categorías existentes (autocompletado)
  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase.from('blog_posts').select('category');
      if (data) {
        const uniqueCategories = Array.from(new Set(data.map(p => p.category).filter(Boolean)));
        setExistingCategories(uniqueCategories as string[]);
      }
    };
    fetchCategories();
  }, []);

  // Cargar post existente si hay postId
  useEffect(() => {
    const loadPost = async () => {
      if (!postId) return;
      const { data } = await supabase.from('blog_posts').select('*').eq('id', postId).single();
      if (data) {
        setTitle(data.title || '');
        setSlug(data.slug || '');
        setExcerpt(data.excerpt || '');
        setCategory(data.category || '');
        setTags((data.tags || []).join(', '));
        setSeoTitle(data.seo_title || '');
        setSeoDescription(data.seo_description || '');
        setStatus(data.status || 'draft');
        setBlocks(data.body || [{ type: 'p', content: '' }]);
        
        setImageHero(data.image_hero || '');
        setImageThumbnail(data.image_thumbnail || '');
        setImageOg(data.image_og || '');
        setImageInline(data.image_inline || '');
        
        setCustomBannerMidSrc(data.custom_banner_mid_src || '');
        setCustomBannerMidHref(data.custom_banner_mid_href || '');
        setCustomBannerFinalSrc(data.custom_banner_final_src || '');
        setCustomBannerFinalHref(data.custom_banner_final_href || '');
      }
    };

    loadPost();
  }, [postId]);

  // Manejador de Subida de Imágenes
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'image_hero' | 'image_thumbnail' | 'image_og' | 'image_inline') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!slug) {
      alert("Por favor, ingresa un título para generar el Slug antes de subir imágenes.");
      return;
    }

    setUploadingImage(field);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${slug}-${field}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('blog_images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('blog_images').getPublicUrl(fileName);

      if (field === 'image_hero') setImageHero(data.publicUrl);
      if (field === 'image_thumbnail') setImageThumbnail(data.publicUrl);
      if (field === 'image_og') setImageOg(data.publicUrl);
      if (field === 'image_inline') setImageInline(data.publicUrl);
      
    } catch (err: any) {
      alert("Error subiendo la imagen: " + err.message);
    } finally {
      setUploadingImage(null);
    }
  };

  // Renderizador del campo de imagen
  const renderImageField = (label: string, field: 'image_hero' | 'image_thumbnail' | 'image_og' | 'image_inline', value: string, setValue: (val: string) => void) => (
    <div className="space-y-2">
      <label className="text-[11px] uppercase tracking-wide font-mono text-text-3 flex justify-between items-center">
        {label}
      </label>
      
      {value ? (
        <div className="relative w-full h-32 rounded-lg border border-border overflow-hidden bg-bg-0 group">
          <img src={value} alt={label} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button 
              onClick={() => setValue('')} 
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-1.5 px-4 rounded text-xs transition-colors shadow-lg"
            >
              Eliminar y subir otra
            </button>
          </div>
        </div>
      ) : (
        <div className="relative group">
          <input 
            type="file" 
            id={`file-${field}`}
            accept="image/*" 
            onChange={(e) => handleImageUpload(e, field)} 
            disabled={uploadingImage !== null || !slug}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" 
            title="Seleccionar imagen desde mi PC"
          />
          <div className={`w-full border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center transition-all ${
            !slug ? 'border-border/50 bg-bg-1/50' : 
            uploadingImage === field ? 'border-accent bg-accent/10' : 'border-border group-hover:border-accent group-hover:bg-bg-2'
          }`}>
            {uploadingImage === field ? (
              <span className="text-accent text-xs font-bold animate-pulse">🚀 Subiendo al Bucket...</span>
            ) : !slug ? (
              <span className="text-text-4 text-[10px] text-center">Escribe un Título primero<br/>para habilitar la subida</span>
            ) : (
              <>
                <span className="text-2xl mb-2 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-transform">💻</span>
                <span className="text-text-1 text-xs font-semibold">Clic para subir imagen local</span>
                <span className="text-text-4 text-[10px] mt-1">(Se guardará en Supabase Storage)</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Manejador de bloques
  const updateBlock = (index: number, field: keyof Block, value: any) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], [field]: value } as Block;
    setBlocks(newBlocks);
  };

  const addBlock = (type: Block['type']) => {
    setBlocks([...blocks, { type, content: '' }]);
  };

  const removeBlock = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index));
  };

  const moveBlockUp = (index: number) => {
    if (index === 0) return;
    const newBlocks = [...blocks];
    const temp = newBlocks[index] as Block;
    newBlocks[index] = newBlocks[index - 1] as Block;
    newBlocks[index - 1] = temp;
    setBlocks(newBlocks);
  };

  const moveBlockDown = (index: number) => {
    if (index === blocks.length - 1) return;
    const newBlocks = [...blocks];
    const temp = newBlocks[index] as Block;
    newBlocks[index] = newBlocks[index + 1] as Block;
    newBlocks[index + 1] = temp;
    setBlocks(newBlocks);
  };

  // Guardar en Supabase
  const handleSave = async () => {
    setLoading(true);
    
    const textContent = blocks.map(b => b.content).join(' ');
    const readTime = Math.max(1, Math.ceil(textContent.split(/\s+/).length / 200));

    // Limpiamos los bloques antes de guardar
    const cleanBlocks = blocks.map(b => ({
      type: b.type,
      content: b.content || '',
      value: b.value,
      items: b.items
    }));

    const postData = {
      title,
      slug,
      excerpt,
      category,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      seo_title: seoTitle,
      seo_description: seoDescription,
      status,
      published: status === 'published',
      published_at: status === 'published' ? new Date().toISOString() : null,
      body: cleanBlocks,
      read_time: readTime,
      image_hero: imageHero,
      image_thumbnail: imageThumbnail,
      image_og: imageOg,
      image_inline: imageInline,
      custom_banner_mid_src: customBannerMidSrc || null,
      custom_banner_mid_href: customBannerMidHref || null,
      custom_banner_final_src: customBannerFinalSrc || null,
      custom_banner_final_href: customBannerFinalHref || null,
    };

    if (postId) {
      await supabase.from('blog_posts').update(postData).eq('id', postId);
    } else {
      await supabase.from('blog_posts').insert([postData]);
    }
    
    setLoading(false);
    if (onSaved) onSaved();
    alert('¡Artículo guardado con éxito!');
  };

  return (
    <div className="flex gap-6 h-full text-text-1">
      {/* Columna Principal: Editor */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 pb-10">
        
        {/* 🎛️ SELECTOR DE VISTAS */}
        <div className="flex gap-2 border-b border-border/20 pb-2 mb-2">
          <Button 
            variant={!previewMode ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setPreviewMode(false)}
            className="text-xs font-semibold"
          >
            📝 Modo Editor
          </Button>
          <Button 
            variant={previewMode ? "secondary" : "ghost"} 
            size="sm" 
            onClick={() => setPreviewMode(true)}
            className="text-xs font-semibold"
          >
            👁️ Vista Previa Live
          </Button>
        </div>

        {!previewMode ? (
          <>
            {/* VISTA 1: INTERFAZ DEL EDITOR CMS */}
            <Input 
              className="text-3xl font-bold border-none bg-transparent placeholder:text-text-3 focus-visible:ring-0 px-0"
              placeholder="Título del artículo..."
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!postId && slug === '') {
                   setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
                }
              }}
            />

            {/* BOTÓN MÁGICO PARA PEGAR DESDE LA IA */}
            <div className="mt-2 mb-2">
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => {
                  const jsonString = prompt('Pega aquí el array JSON generado por Gemini (ej: [{"type":"p", "content":"..."}]):');
                  if (!jsonString) return;
                  try {
                    const parsedBlocks = JSON.parse(jsonString);
                    if (Array.isArray(parsedBlocks)) {
                      setBlocks(parsedBlocks);
                    } else {
                      alert('El JSON debe ser un Array válido.');
                    }
                  } catch (e) {
                    alert('JSON inválido. Revisa que no haya texto extra alrededor del código.');
                  }
                }}
                className="text-[11px] font-mono border-dashed border-accent/50 text-accent hover:bg-accent/10"
              >
                🤖 Importar JSON desde Gemini
              </Button>
            </div>
            
            {/* Renderizado de Bloques en modo edición */}
            <div className="space-y-4 mt-6">
              {blocks.map((block, index) => (
                <div key={index} className="group relative flex gap-2 border-b border-border/20 pb-4 last:border-0">
                  <select 
                    className="bg-bg-2 border border-border text-sm p-2 rounded h-fit opacity-50 group-hover:opacity-100 transition-opacity text-text-1 focus:outline-none"
                    value={block.type}
                    onChange={(e) => updateBlock(index, 'type', e.target.value as Block['type'])}
                  >
                    <option value="p">Párrafo</option>
                    <option value="h2">Título H2</option>
                    <option value="h3">Subtítulo H3</option>
                    <option value="callout">Callout (Cita)</option>
                    <option value="stat">Estadística</option>
                    <option value="list">📝 Lista</option>
                    <option value="image">📸 Imagen Interna</option>
                    <option value="box">📦 Caja Estilizada</option>
                    <option value="button">🔥 Botón CTA 3D</option>
                  </select>

                  <div className="flex-1 flex flex-col gap-2">
                    
                    {/* STAT */}
                    {block.type === 'stat' && (
                      <Input 
                        placeholder="Valor (ej: 82%)"
                        value={block.value || ''}
                        onChange={(e) => updateBlock(index, 'value', e.target.value)}
                        className="w-1/3 bg-bg-2 border-border"
                      />
                    )}

                    {/* BOX */}
                    {block.type === 'box' && (
                      <select 
                        className="w-1/3 bg-bg-2 border border-border text-xs p-2 rounded text-text-1 focus:outline-none"
                        value={block.value || 'gradient'}
                        onChange={(e) => updateBlock(index, 'value', e.target.value)}
                      >
                        <option value="gradient">🌌 Degradado Neón (Sharkania)</option>
                        <option value="shadow">🕳️ Sombra Profunda (Dark Mode)</option>
                        <option value="3d">💎 Relieve 3D Tech</option>
                      </select>
                    )}

                    {/* LIST */}
                    {block.type === 'list' && (
                      <div className="flex flex-col gap-3 p-4 bg-bg-1 rounded-lg border border-border mt-2">
                        <label className="text-xs text-text-3 font-bold uppercase tracking-wider">Elementos de la Lista</label>
                        <div className="space-y-2">
                          {(block.items ?? []).map((item, itemIndex) => (
                            <div key={itemIndex} className="flex gap-2 items-center">
                              <Input 
                                id={`list-${index}-item-${itemIndex}`} // 🔥 Añadimos ID para ubicar la selección
                                value={item} 
                                onChange={(e) => {
                                  const newItems = [...(block.items ?? [])];
                                  newItems[itemIndex] = e.target.value;
                                  updateBlock(index, 'items', newItems);
                                }}
                                placeholder={`Ítem ${itemIndex + 1}...`}
                                className="flex-1 bg-bg-2 border-border text-sm"
                              />
                              
                              {/* 🔥 NUEVO: Botón de Enlace para Listas */}
                              <button 
                                onClick={() => {
                                  const inputEl = document.getElementById(`list-${index}-item-${itemIndex}`) as HTMLInputElement;
                                  if (!inputEl) return;
                                  
                                  const start = inputEl.selectionStart || 0;
                                  const end = inputEl.selectionEnd || 0;
                                  const selectedText = inputEl.value.substring(start, end);
                                  
                                  if (!selectedText) {
                                    alert("☝️ Primero selecciona con el mouse la palabra en este ítem.");
                                    return;
                                  }
                                  
                                  const url = prompt(`Ingresa la URL para enlazar "${selectedText}":`);
                                  if (!url) return;
                                  
                                  const linkMarkdown = `[${selectedText}](${url})`;
                                  const newContent = inputEl.value.substring(0, start) + linkMarkdown + inputEl.value.substring(end);
                                  
                                  const newItems = [...(block.items ?? [])];
                                  newItems[itemIndex] = newContent;
                                  updateBlock(index, 'items', newItems);
                                }}
                                className="text-text-3 hover:text-accent p-1 transition-colors text-lg"
                                title="Selecciona un texto y presiona para enlazar"
                              >
                                🔗
                              </button>

                              <button 
                                onClick={() => {
                                  const newItems = (block.items ?? []).filter((_, i) => i !== itemIndex);
                                  updateBlock(index, 'items', newItems);
                                }}
                                className="text-red-500 hover:text-red-600 p-1 font-bold text-lg"
                                title="Eliminar ítem"
                              >✕</button>
                            </div>
                          ))}
                        </div>
                        <Button 
                          variant="secondary" size="sm" 
                          onClick={() => {
                            const newItems = [...(block.items ?? []), ''];
                            updateBlock(index, 'items', newItems);
                          }}
                          className="text-xs font-semibold w-fit mt-2 border-border hover:border-accent"
                        >+ Añadir ítem</Button>
                      </div>
                    )}

                    {/* IMAGE */}
                    {block.type === 'image' && (
                      <div className="space-y-2 bg-bg-1 p-3 rounded-lg border border-border">
                        {block.value ? (
                          <div className="relative w-full max-h-60 rounded overflow-hidden border border-border">
                            <img src={block.value} alt="Inline" className="w-full h-full object-contain max-h-60" />
                            <button 
                              onClick={() => updateBlock(index, 'value', '')}
                              className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full text-xs px-2"
                            >Eliminar Imagen</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-4">
                            <input 
                              type="file" accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || !slug) return alert('Asigna un título al post antes de subir imágenes.');
                                const fileExt = file.name.split('.').pop();
                                const fileName = `inline-${Math.random().toString(36).substring(2)}.${fileExt}`;
                                const filePath = `${slug}/${fileName}`;
                                
                                alert('Subiendo imagen interna...');
                                const { error } = await supabase.storage.from('blog_images').upload(filePath, file);
                                if (error) return alert('Error al subir: ' + error.message);
                                
                                const { data: urlData } = supabase.storage.from('blog_images').getPublicUrl(filePath);
                                updateBlock(index, 'value', urlData.publicUrl);
                              }}
                              className="text-xs text-text-3"
                            />
                            <p className="text-[11px] text-text-4">Sube una imagen</p>
                          </div>
                        )}
                        <Input 
                          placeholder="Pie de foto / Leyenda de la imagen (Opcional)..." 
                          value={block.content} 
                          onChange={(e) => updateBlock(index, 'content', e.target.value)} 
                          className="bg-bg-2 border-border text-xs" 
                        />
                      </div>
                    )}

                    {/* BUTTON */}
                    {block.type === 'button' && (
                      <div className="flex flex-col gap-2 p-4 bg-bg-3 rounded-lg border border-dashed border-accent/50">
                        <label className="text-xs text-text-3 font-bold uppercase tracking-wider">Configuración del Botón 3D</label>
                        <Input placeholder="Texto del Botón (Ej: DESCARGAR WPT)" value={block.content || ''} onChange={(e) => updateBlock(index, 'content', e.target.value)} className="bg-bg-1 border-border font-extrabold text-text-1" />
                        <Input placeholder="URL del enlace (Ej: https://tracking...)" value={block.value || ''} onChange={(e) => updateBlock(index, 'value', e.target.value)} className="bg-bg-1 border-border text-xs font-mono text-accent" />
                      </div>
                    )}

                    {/* TEXTO ESTÁNDAR (p, h2, h3, callout, box) CON BARRA DE ENLACES */}
                    {['p', 'h2', 'h3', 'callout', 'box'].includes(block.type) && (
                      <div className="flex flex-col">
                        {/* 🔥 MINI BARRA DE FORMATO ESTILO WORDPRESS */}
                        <div className="flex gap-2 bg-bg-2/50 border border-b-0 border-border p-1.5 rounded-t-lg">
                          <button
                            onClick={() => {
                              const textarea = document.getElementById(`textarea-${index}`) as HTMLTextAreaElement;
                              if (!textarea) return;
                              
                              const start = textarea.selectionStart;
                              const end = textarea.selectionEnd;
                              const selectedText = textarea.value.substring(start, end);
                              
                              if (!selectedText) {
                                alert("☝️ Primero selecciona con el mouse la palabra que quieres enlazar.");
                                return;
                              }
                              
                              const url = prompt(`Ingresa la URL para enlazar "${selectedText}":`);
                              if (!url) return;
                              
                              const linkMarkdown = `[${selectedText}](${url})`;
                              const newContent = textarea.value.substring(0, start) + linkMarkdown + textarea.value.substring(end);
                              
                              updateBlock(index, 'content', newContent);
                            }}
                            className="flex items-center gap-1.5 text-[11px] uppercase font-bold bg-bg-1 hover:bg-accent/20 hover:text-accent text-text-3 px-3 py-1.5 rounded transition-colors border border-border"
                            title="Selecciona un texto y haz clic aquí para hacerlo link"
                          >
                            🔗 Enlazar Selección
                          </button>
                        </div>

                        <textarea
                          id={`textarea-${index}`}
                          className={`w-full bg-transparent border border-border focus:border-accent p-3 rounded-b-lg resize-none outline-none ${
                            block.type === 'h2' ? 'text-2xl font-bold text-text-1' : 
                            block.type === 'h3' ? 'text-xl font-semibold text-accent' : 
                            block.type === 'callout' ? 'italic text-text-2 bg-bg-2' : 
                            block.type === 'box' ? 'p-4 bg-bg-3 border-dashed' : 'text-base text-text-1'
                          }`}
                          placeholder={`Escribe aquí... (Selecciona texto y presiona "Enlazar")`}
                          value={block.content}
                          onChange={(e) => {
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                            updateBlock(index, 'content', e.target.value);
                          }}
                          rows={2}
                        />
                      </div>
                    )}
                  </div>

                  {/* 🔥 PANEL DE CONTROL DEL BLOQUE (Mover y Eliminar) */}
                  <div className="opacity-0 group-hover:opacity-100 flex flex-col gap-1 transition-opacity h-fit items-center bg-bg-2/50 p-1 rounded border border-border/50">
                    <button 
                      onClick={() => moveBlockUp(index)}
                      disabled={index === 0}
                      className="text-text-3 hover:text-accent hover:bg-accent/10 p-1.5 rounded disabled:opacity-20 disabled:hover:bg-transparent transition-colors text-xs"
                      title="Mover arriba"
                    >▲</button>
                    <button 
                      onClick={() => moveBlockDown(index)}
                      disabled={index === blocks.length - 1}
                      className="text-text-3 hover:text-accent hover:bg-accent/10 p-1.5 rounded disabled:opacity-20 disabled:hover:bg-transparent transition-colors text-xs"
                      title="Mover abajo"
                    >▼</button>
                    <div className="w-full h-px bg-border my-1" />
                    <button 
                      onClick={() => removeBlock(index)}
                      className="text-red-500 hover:bg-red-500/10 p-1.5 rounded transition-colors text-xs"
                      title="Eliminar bloque"
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Añadir bloques */}
            <div className="flex gap-2 border border-dashed border-border p-4 rounded-lg items-center justify-center mt-4 opacity-50 hover:opacity-100 transition-opacity flex-wrap">
              <Button variant="ghost" onClick={() => addBlock('p')}>+ Párrafo</Button>
              <Button variant="ghost" onClick={() => addBlock('h2')}>+ H2</Button>
              <Button variant="ghost" onClick={() => addBlock('callout')}>+ Callout</Button>
              <Button variant="ghost" onClick={() => addBlock('stat')}>+ Estadística</Button>
              <Button variant="ghost" onClick={() => setBlocks([...blocks, { type: 'list', content: '', items: [''] }])}>+ 📝 Lista</Button>
              <Button variant="ghost" onClick={() => setBlocks([...blocks, { type: 'image', content: '', value: '' }])}>+ 📸 Imagen</Button>
              <Button variant="ghost" onClick={() => setBlocks([...blocks, { type: 'box', content: '', value: 'gradient' }])}>+ 📦 Caja Especial</Button>
              <Button variant="ghost" onClick={() => setBlocks([...blocks, { type: 'button', content: 'DESCARGAR WPT GLOBAL', value: 'https://tracking.wptpartners.com/visit/?bta=35660&nci=15036' }])}>+ 🔥 Botón CTA</Button>
            </div>
          </>
        ) : (
          /* 👁️ VISTA 2: RENDERIZADO SIMULADO EN VIVO */
          <div className="mt-4 p-6 rounded-xl bg-[#0c0d10] border border-border max-w-[720px] mx-auto w-full shadow-2xl font-sans">
            {imageHero && (
              <div className="w-full max-h-[280px] overflow-hidden rounded-xl mb-6">
                <img src={imageHero} alt="Hero Banner" className="w-full h-full object-cover" />
              </div>
            )}
            <h1 className="text-3xl font-extrabold text-white leading-tight mb-4">{title || 'Artículo Sin Título'}</h1>
            <p className="text-sm text-text-2 border-l-2 border-accent pl-4 mb-6 italic">{excerpt || 'Sin extracto configurado.'}</p>
            <div className="h-px bg-border/20 my-5" />

            <div className="space-y-5">
              {blocks.map((block, i) => {
                
                // Usamos renderWithLinks para procesar Markdown a nodos React seguros
                if (block.type === 'h2') return <h2 key={i} className="text-xl font-extrabold text-white tracking-tight mt-8 mb-3">{renderWithLinks(block.content)}</h2>;
                if (block.type === 'h3') return <h3 key={i} className="text-lg font-bold text-white mt-5 mb-2">{renderWithLinks(block.content)}</h3>;
                if (block.type === 'p') return <p key={i} className="text-sm text-text-2 leading-relaxed mb-3">{renderWithLinks(block.content)}</p>;
                if (block.type === 'callout') return <div key={i} className="my-5 rounded-lg border border-accent/20 bg-accent/5 px-4 py-3.5"><p className="text-sm text-white font-medium leading-relaxed">{renderWithLinks(block.content)}</p></div>;
                if (block.type === 'stat') return <div key={i} className="my-5 rounded-xl border border-border bg-bg-2 px-4 py-4 flex items-center gap-4"><span className="text-3xl font-extrabold text-accent leading-none">{block.value}</span><p className="text-xs text-text-2 leading-snug">{renderWithLinks(block.content)}</p></div>;
                
                if (block.type === 'list') {
                  return (
                    <ul key={i} className="my-5 space-y-2 pl-5 list-disc marker:text-accent text-sm text-text-2">
                      {(block.items ?? []).map((item, j) => (
                        <li key={j} className="pl-1 leading-relaxed">{renderWithLinks(item)}</li>
                      ))}
                    </ul>
                  );
                }

                if (block.type === 'image') return (
                  <figure key={i} className="my-6">
                    <div className="overflow-hidden rounded-xl border border-border bg-bg-3">
                      <img src={block.value || 'https://placehold.co/600x340/111214/71717a?text=Carga+una+imagen+desde+el+editor'} alt="Inline" className="w-full h-auto max-h-80 object-contain" />
                    </div>
                    {block.content && <figcaption className="text-center text-[11px] text-text-4 mt-2 font-mono">{renderWithLinks(block.content)}</figcaption>}
                  </figure>
                );

                if (block.type === 'box') {
                  let boxStyle = "bg-bg-2 border-border";
                  if (block.value === "gradient") boxStyle = "bg-gradient-to-br from-bg-3 via-bg-2 to-accent/10 border-accent/30 shadow-[0_0_20px_rgba(34,211,238,0.05)]";
                  if (block.value === "shadow") boxStyle = "bg-bg-1 border-border/60 shadow-[0_20px_40px_rgba(0,0,0,0.6)]";
                  if (block.value === "3d") boxStyle = "bg-bg-3 border-t border-l border-white/10 border-b-[4px] border-r-[4px] border-black/80";
                  return <div key={i} className={`my-5 p-4 rounded-xl border ${boxStyle}`}><p className="text-sm text-white leading-relaxed font-medium">{renderWithLinks(block.content)}</p></div>;
                }

                if (block.type === 'button') {
                  return (
                    <div key={i} className="my-10 flex justify-center">
                      <a 
                        href={block.value || '#'} target="_blank" rel="noopener noreferrer"
                        className="inline-block px-10 py-4 text-center font-extrabold text-white text-lg tracking-wider uppercase rounded-xl bg-gradient-to-r from-accent to-blue-600 shadow-[0_10px_30px_rgba(34,211,238,0.4)] hover:shadow-[0_15px_40px_rgba(34,211,238,0.6)] hover:-translate-y-1 transition-all duration-300 border-t border-t-white/20 border-b-[4px] border-b-black/50"
                      >
                        {renderWithLinks(block.content || 'CLIC AQUÍ')}
                      </a>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        )}
      </div>

      {/* Columna Derecha: Metadatos */}
      <div className="w-80 flex flex-col gap-4 border-l border-border pl-6 overflow-y-auto pb-10">
        
        <Card className="p-4 space-y-4 bg-bg-1 border-border">
          <h3 className="font-bold border-b border-border pb-2 text-text-1 flex items-center gap-2">
            <span className="text-lg">🖼️</span> Imágenes
          </h3>
          {renderImageField('Banner Principal (Hero)', 'image_hero', imageHero, setImageHero)}
          {renderImageField('Miniatura (Thumbnail)', 'image_thumbnail', imageThumbnail, setImageThumbnail)}
          {renderImageField('Redes Sociales (OG)', 'image_og', imageOg, setImageOg)}
          {renderImageField('Intermedia (Inline)', 'image_inline', imageInline, setImageInline)}
        </Card>

        <Card className="p-4 space-y-6 bg-bg-1 border-accent/30 shadow-[0_0_15px_rgba(34,211,238,0.05)]">
          <h3 className="font-bold border-b border-border pb-2 text-text-1 flex items-center gap-2">
            📢 Publicidad Exclusiva <span className="text-[10px] text-accent font-normal px-2 py-0.5 bg-accent/10 rounded-full">Opcional</span>
          </h3>
          <p className="text-[10px] text-text-4 leading-tight italic -mt-2">
            Rellenar estos campos anula la publicidad predeterminada y muestra la tuya solo en este artículo.
          </p>

          <div className="p-3 bg-bg-2 border border-border rounded-lg space-y-3">
            <h4 className="text-[11px] font-mono uppercase text-accent font-bold">1. Banner Intermedio</h4>
            <div>
              <label className="text-[10px] text-text-3">Imagen (URL)</label>
              <Input className="mt-1 bg-bg-0 border-border text-xs" value={customBannerMidSrc} onChange={(e) => setCustomBannerMidSrc(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label className="text-[10px] text-text-3">URL Destino (Afiliado)</label>
              <Input className="mt-1 bg-bg-0 border-border text-xs" value={customBannerMidHref} onChange={(e) => setCustomBannerMidHref(e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div className="p-3 bg-bg-2 border border-border rounded-lg space-y-3">
            <h4 className="text-[11px] font-mono uppercase text-accent font-bold">2. Banner Final (Cierre)</h4>
            <div>
              <label className="text-[10px] text-text-3">Imagen (URL)</label>
              <Input className="mt-1 bg-bg-0 border-border text-xs" value={customBannerFinalSrc} onChange={(e) => setCustomBannerFinalSrc(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label className="text-[10px] text-text-3">URL Destino (Afiliado)</label>
              <Input className="mt-1 bg-bg-0 border-border text-xs" value={customBannerFinalHref} onChange={(e) => setCustomBannerFinalHref(e.target.value)} placeholder="https://..." />
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-4 bg-bg-1 border-border">
          <h3 className="font-bold border-b border-border pb-2 text-text-1">Publicación</h3>
          
          <div>
            <label className="text-xs text-text-3">Estado</label>
            <select 
              className="w-full bg-bg-2 border border-border p-2 rounded text-sm mt-1 text-text-1 focus:outline-none"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-text-3">Slug (URL)</label>
            <Input className="mt-1 bg-bg-2 border-border" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>

          <div>
            <label className="text-xs text-text-3">Categoría</label>
            <Input 
              className="mt-1 bg-bg-2 border-border" 
              value={category} 
              onChange={(e) => setCategory(e.target.value)} 
              placeholder="Ej: Estrategia" 
              list="existing-categories"
            />
            <datalist id="existing-categories">
              {existingCategories.map((cat, i) => (
                <option key={i} value={cat} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="text-xs text-text-3">Etiquetas (separadas por coma)</label>
            <Input className="mt-1 bg-bg-2 border-border" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="GTO, Torneos" />
          </div>

          <Button 
            className="w-full bg-accent text-bg-0 hover:bg-accent/90" 
            onClick={handleSave} 
            disabled={loading}
          >
            {loading ? 'Guardando...' : 'Guardar Artículo'}
          </Button>
        </Card>

        <Card className="p-4 space-y-4 bg-bg-1 border-border">
          <h3 className="font-bold border-b border-border pb-2 text-text-1">SEO & Metadatos</h3>
          
          <div>
            <label className="text-xs text-text-3">Extracto (Página de Blog)</label>
            <textarea 
              className="w-full bg-bg-2 border border-border p-2 rounded text-sm mt-1 h-24 resize-none text-text-1 focus:outline-none focus:border-accent"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-text-3">Meta Título (Google)</label>
            <Input className="mt-1 bg-bg-2 border-border" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
            <span className="text-[10px] text-text-3">{seoTitle.length}/60 caracteres</span>
          </div>

          <div>
            <label className="text-xs text-text-3">Meta Descripción</label>
            <textarea 
              className="w-full bg-bg-2 border border-border p-2 rounded text-sm mt-1 h-24 resize-none text-text-1 focus:outline-none focus:border-accent"
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
            />
            <span className="text-[10px] text-text-3">{seoDescription.length}/160 caracteres</span>
          </div>
        </Card>
      </div>
    </div>
  );
}