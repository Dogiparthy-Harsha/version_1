import React from 'react';

// --- Base Components ---

const A2UIText = ({ content, variant = 'body', color }) => {
    const baseStyle = { color: color || 'inherit', lineHeight: '1.5' };

    switch (variant) {
        case 'h1': return <h1 style={{ ...baseStyle, fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{content}</h1>;
        case 'h2': return <h2 style={{ ...baseStyle, fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{content}</h2>;
        case 'h3': return <h3 style={{ ...baseStyle, fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>{content}</h3>;
        case 'caption': return <span style={{ ...baseStyle, fontSize: '0.875rem', color: '#6b7280' }}>{content}</span>;
        case 'label': return <label style={{ ...baseStyle, fontWeight: '500', fontSize: '0.875rem' }}>{content}</label>;
        case 'body':
        default: return <p style={{ ...baseStyle, marginBottom: '0.25rem' }}>{content}</p>;
    }
};

const A2UIImage = ({ src, alt, width, height }) => (
    <img
        src={src}
        alt={alt}
        style={{
            width: width || '100%',
            height: height || 'auto',
            maxWidth: '100%',
            objectFit: 'contain', // FIXED: Prevents stretching/distortion
            backgroundColor: '#f3f4f6', // Light gray background for padded areas
            borderRadius: '0.375rem', // rounded-md
            display: 'block'
        }}
    />
);

const A2UIButton = ({ label, variant = 'primary', action_id, payload, onAction }) => {
    const baseStyle = {
        padding: '0.5rem 1rem',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        fontWeight: '500',
        cursor: 'pointer',
        border: 'none',
        transition: 'background-color 0.2s',
        outline: 'none',
    };

    const variants = {
        primary: {
            backgroundColor: '#2563eb', // blue-600
            color: 'white',
        },
        secondary: {
            backgroundColor: '#e5e7eb', // gray-200
            color: '#1f2937', // gray-800
        },
        outline: {
            backgroundColor: 'transparent',
            border: '1px solid #d1d5db', // gray-300
            color: '#374151', // gray-700
        },
        ghost: {
            backgroundColor: 'transparent',
            color: '#2563eb', // blue-600
        },
    };

    const style = { ...baseStyle, ...(variants[variant] || variants.primary) };

    return (
        <button
            style={style}
            onClick={() => onAction && onAction(action_id, payload)}
            onMouseOver={(e) => {
                if (variant === 'primary') e.target.style.backgroundColor = '#1d4ed8'; // blue-700
                else if (variant === 'secondary') e.target.style.backgroundColor = '#d1d5db'; // gray-300
                else if (variant === 'ghost') e.target.style.textDecoration = 'underline';
            }}
            onMouseOut={(e) => {
                if (variant === 'primary') e.target.style.backgroundColor = '#2563eb';
                else if (variant === 'secondary') e.target.style.backgroundColor = '#e5e7eb';
                else if (variant === 'ghost') e.target.style.textDecoration = 'none';
            }}
        >
            {label}
        </button>
    );
};

const A2UIBox = ({ children, direction = 'column', gap = '0.5rem', padding, alignment = 'start', onAction }) => {
    const style = {
        display: 'flex',
        flexDirection: direction,
        gap: gap,
        padding: padding,
        alignItems: alignment === 'start' ? 'flex-start' : alignment === 'center' ? 'center' : alignment === 'end' ? 'flex-end' : 'stretch',
        width: '100%'
    };

    return (
        <div style={style}>
            {children.map((child, index) => (
                <A2UIComponent key={index} component={child} onAction={onAction} />
            ))}
        </div>
    );
};

// --- Composite Components ---

const A2UICard = ({ title, subtitle, image, content = [], actions = [], onAction }) => {
    return (
        <div style={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb', // gray-200
            borderRadius: '0.5rem', // rounded-lg
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            overflow: 'hidden',
            marginBottom: '1rem',
            maxWidth: '300px' // Added constraint for better card look
        }}>
            {image && <A2UIImage {...image} />}

            <div style={{ padding: '1rem' }}>
                {title && (
                    <h3 style={{
                        fontSize: '1.125rem',
                        fontWeight: '600',
                        color: '#111827', // gray-900
                        marginBottom: '0.25rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }} title={title}>
                        {title}
                    </h3>
                )}
                {subtitle && (
                    <p style={{
                        fontSize: '0.875rem',
                        color: '#6b7280', // gray-500
                        marginBottom: '0.75rem'
                    }}>
                        {subtitle}
                    </p>
                )}

                {content && content.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                        {content.map((item, idx) => (
                            <A2UIComponent key={idx} component={item} onAction={onAction} />
                        ))}
                    </div>
                )}

                {actions && actions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {actions.map((action, idx) => (
                            <A2UIButton key={idx} {...action} onAction={onAction} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const A2UIList = ({ items, orientation = 'vertical', onAction }) => {
    const isHorizontal = orientation === 'horizontal';
    const style = isHorizontal ? {
        display: 'flex',
        overflowX: 'auto',
        gap: '1rem',
        padding: '0.5rem 0',
        scrollSnapType: 'x mandatory'
    } : {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: '1rem'
    };

    return (
        <div style={style} className={isHorizontal ? 'no-scrollbar' : ''}>
            {items.map((item, index) => (
                <div key={index} style={isHorizontal ? { minWidth: '280px', scrollSnapAlign: 'center' } : { width: '100%' }}>
                    <A2UIComponent component={item} onAction={onAction} />
                </div>
            ))}
        </div>
    );
};

// --- Main Renderer ---

const A2UIComponent = ({ component, onAction }) => {
    if (!component) return null;

    switch (component.type) {
        case 'text': return <A2UIText {...component} />;
        case 'image': return <A2UIImage {...component} />;
        case 'button': return <A2UIButton {...component} onAction={onAction} />;
        case 'box': return <A2UIBox {...component} onAction={onAction} />;
        case 'card': return <A2UICard {...component} onAction={onAction} />;
        case 'list': return <A2UIList {...component} onAction={onAction} />;
        default:
            console.warn(`Unknown A2UI component type: ${component.type}`);
            return null;
    }
};

const A2UIRenderer = ({ content, onAction }) => {
    if (!content || !content.root) return null;

    return (
        <div style={{ width: '100%', margin: '1rem 0' }}>
            <A2UIComponent component={content.root} onAction={onAction} />
        </div>
    );
};

export default A2UIRenderer;
